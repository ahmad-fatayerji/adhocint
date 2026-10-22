import unittest
from runner import apply_result


class FailureThresholdTests(unittest.TestCase):
    def test_first_failure_retries_without_changing_previous_status(self):
        state = {"checks": {}}
        apply_result(state, {"name": "db", "ok": True, "message": "ok"}, 100)
        record = apply_result(state, {"name": "db", "ok": False, "message": "authentication failed"}, 160)
        self.assertEqual(record["failures"], 1)
        self.assertEqual(record["status"], "up")
        self.assertEqual(record["last_success"], 100)
        self.assertEqual(record["next_due"], 190)

    def test_second_failure_marks_down_and_success_recovers(self):
        state = {"checks": {}}
        failed = {"name": "storage_write", "ok": False, "message": "cleanup failed"}
        apply_result(state, failed, 100)
        record = apply_result(state, failed, 130)
        self.assertEqual(record["status"], "down")
        self.assertEqual(record["next_due"], 160)
        record = apply_result(state, {"name": "storage_write", "ok": True, "message": "ok"}, 160)
        self.assertEqual(record["status"], "up")
        self.assertEqual(record["failures"], 0)
        self.assertEqual(record["next_due"], 460)

    def test_first_failure_is_never_a_successful_probe(self):
        state = {"checks": {}}
        record = apply_result(state, {"name": "images", "ok": False, "message": "HTTP failed"}, 100)
        self.assertNotIn("last_success", record)
        self.assertNotIn("status", record)


if __name__ == '__main__':
    unittest.main()
