#!/usr/bin/env python3
"""Run bounded checks and report confirmed results to local Uptime Kuma."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.parse
import urllib.request
import uuid

INTERVALS = {"db": 60, "storage_read": 60, "storage_write": 300,
             "images": 300, "gokapi_api": 60, "gokapi_transfer": 300}


def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.chmod(0o600)
    temporary.replace(path)


def apply_result(state, result, now):
    check = state.setdefault("checks", {}).setdefault(result["name"], {})
    check["failures"] = 0 if result["ok"] else check.get("failures", 0) + 1
    check.update(last_attempt=now, message=result["message"], ms=result.get("ms", 0))
    check["next_due"] = now + (INTERVALS[result["name"]] if result["ok"] else 30)
    if result["ok"]:
        check.update(status="up", last_success=now)
    elif check["failures"] >= 2:
        check["status"] = "down"
    return check


def push(config, key, status, message, ms=0, dry_run=False):
    token = config["push_tokens"].get(key)
    if not token:
        return
    if dry_run:
        print(f"DRY_RUN {key}: {status} ({message})", flush=True)
        return
    query = urllib.parse.urlencode({"status": status, "msg": message, "ping": ms})
    url = config.get("kuma_url", "http://127.0.0.1:3002") + "/api/push/" + token + "?" + query
    # Tokens stay on loopback; never log request URLs or raw exceptions.
    with urllib.request.urlopen(url, timeout=5) as response:
        if not json.load(response).get("ok"):
            raise RuntimeError("Kuma rejected probe result")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="/opt/adhocint/shared/monitoring/config.json")
    parser.add_argument("--state", default="/opt/adhocint/shared/monitoring/state.json")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--seed", action="store_true")
    args = parser.parse_args()
    os.umask(0o077)
    config_path, state_path = Path(args.config), Path(args.state)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    with state_path.with_suffix('.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        config = json.loads(config_path.read_text())
        state = json.loads(state_path.read_text()) if state_path.exists() else {"checks": {}, "pending": {}}
        now = time.time()
        tasks = [name for name in INTERVALS if args.force or state["checks"].get(name, {}).get("next_due", 0) <= now]
        if args.seed:
            tasks = []
        elif not tasks:
            push(config, "runner", "up", "probe scheduler running", dry_run=args.dry_run)
            return
        pending = state.setdefault("pending", {})
        if "storage_write" in tasks and not pending.get("storage"):
            pending["storage"] = {"key": "_monitoring/adhocint/write-" + str(uuid.uuid4()) + ".bin"}
        if "gokapi_transfer" in tasks and not pending.get("gokapi"):
            pending["gokapi"] = {"name": "adhoc-monitor-" + str(uuid.uuid4()) + ".txt", "password": secrets.token_urlsafe(24)}
        save(state_path, state)
        root = Path(__file__).resolve().parent
        command = ["podman", "run", "--rm", "-i", "--name", "adhocint-monitor-probe",
                   "--network", "adhocint", "--user", "0", "--memory", "192m", "--cpus", "0.5",
                   "--add-host", "adhocint.com:host-gateway", "--add-host", "share.adhocint.com:host-gateway",
                   "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                   "--tmpfs", "/tmp:rw,size=16m", "--env-file", config["app_env"],
                   "--env-file", config["probe_env"], "-v", str(root / "probes.cjs") + ":/monitor/probes.cjs:ro",
                   config.get("runtime_image", "localhost/adhocint-web:latest"), "node", "/monitor/probes.cjs"]
        # The shell timeout bounds a hung child, even if it stops emitting output.
        process = subprocess.Popen(["timeout", "80s"] + command, stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        process.stdin.write(json.dumps({"tasks": tasks, "pending": pending, "seed": args.seed}))
        process.stdin.close()
        seen = set()
        for line in process.stdout:
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get("event") == "pending":
                state["pending"][event["kind"]] = event["value"]
                save(state_path, state)
            elif event.get("event") == "result" and event.get("name") in tasks:
                seen.add(event["name"])
                record = apply_result(state, event, time.time())
                save(state_path, state)
                print(event["name"] + ": " + ("OK " if event["ok"] else "FAIL ") + event["message"], flush=True)
                if event["name"] not in ("storage_read", "storage_write") and (event["ok"] or record["failures"] >= 2):
                    push(config, event["name"], record["status"], record["message"], record["ms"], args.dry_run)
        returncode = process.wait()
        if returncode != 0:
            subprocess.run(["podman", "rm", "-f", "adhocint-monitor-probe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if args.seed:
            if returncode:
                raise RuntimeError("Canary initialization failed")
            return
        for name in set(tasks) - seen:
            record = apply_result(state, {"name": name, "ok": False, "message": "probe_process_incomplete"}, time.time())
            if record["failures"] >= 2 and name not in ("storage_read", "storage_write"):
                push(config, name, "down", record["message"], dry_run=args.dry_run)
        read = state["checks"].get("storage_read", {})
        write = state["checks"].get("storage_write", {})
        failures = [value for value in (read, write) if value.get("failures", 0) >= 2]
        if failures:
            push(config, "storage", "down", failures[0]["message"], dry_run=args.dry_run)
        elif all(value.get("status") == "up" and value.get("failures", 0) == 0 for value in (read, write)):
            if time.time() - read["last_success"] < 180 and time.time() - write["last_success"] < 420:
                push(config, "storage", "up", "authenticated read and write/delete checks healthy", dry_run=args.dry_run)
        save(state_path, state)
        push(config, "runner", "up", "probe scheduler running", dry_run=args.dry_run)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Systemd records failure; missing heartbeat detects reporter failures.
        print("Monitoring runner failed; inspect local configuration and service state", flush=True)
        raise SystemExit(1)
