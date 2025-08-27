"use client";
import Image from "next/image";
import Button from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string>("");
  const tRef = useRef<number>(Date.now());

  useEffect(() => {
    tRef.current = Date.now();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, string> = {};
    formData.forEach((v, k) => (payload[k] = String(v)));
    payload.t = String(tRef.current);
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed");
      }
      setStatus("success");
      form.reset();
      tRef.current = Date.now();
      setTimeout(() => setStatus("idle"), 5000);
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Error");
    }
  }
  return (
    <main>
      {/* Hero */}
      <section className="section">
        <div className="container mx-auto px-4 max-w-5xl grid md:grid-cols-2 items-start gap-10">
          <div className="md:col-span-2 lg:col-span-1">
            <h1 className="hero-title font-bold">
              Building with precision. Delivering with integrity.
            </h1>
            <p className="hero-subtitle mt-4 max-w-prose">
              AD HOC International is your partner for engineering, construction
              and project management in the general contracting field. From
              concept design, detailed design, tender documents, shop drawings,
              to a complete solution, the company manages projects of small and
              medium sizes in a cost-effective way.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/projects">
                <Button>View Projects</Button>
              </a>
              <a href="#contact">
                <Button variant="outline">Contact Us</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="section bg-[var(--brand-light)]/60">
        <div className="container mx-auto px-4 grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-[var(--brand-blue)]">
                About Us
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2 leading-7 text-balance">
                <li>
                  AD HOC is multi-disciplinary architectural and engineering
                  consultancy and construction firm.
                </li>
                <li>
                  AD HOC has the practical know-how, insight and resources to
                  offer comprehensive services and specialized solutions.
                </li>
                <li>
                  The consultancy successfully rises to design challenges and
                  our array of services addresses the real needs of clients in
                  both the public and private sectors.
                </li>
                <li>
                  AD HOC achieves this by building on our long-standing
                  experience and by analyzing each project's context,
                  environment, budget, purpose and goal.
                </li>
                <li>
                  In the heart of Beirut-Lebanon, AD HOC International is
                  located in Hamra area.
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-[var(--brand-brown)]">
                Why Choose Us
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>Senior leadership directly engaged on every project</li>
                <li>Agile decision-making for faster issue resolution</li>
                <li>Tailored, right-sized engineering (no over-design)</li>
                <li>
                  Integrated multidisciplinary coordination minimizing rework
                </li>
                <li>Transparent communication & single point of contact</li>
                <li>Accountability and long-term partner mindset</li>
              </ul>
            </CardContent>
          </Card>
        </div>
        <div className="container mx-auto px-4 mt-6 text-center">
          <a href="/services">
            <Button className="px-8">
              Learn more about the services we offer
            </Button>
          </a>
        </div>
      </section>

      {/* Projects removed from homepage; now a dedicated /projects page */}

      {/* Contact */}
      <section
        id="contact"
        className="section pb-6 bg-[var(--brand-blue)] text-white"
      >
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl font-bold">Let’s work together</h2>
            <p className="mt-2 text-white/90">
              Send us your project details and we’ll get back to you as soon as
              possible.
            </p>
          </div>
          <form className="grid grid-cols-2 gap-3" onSubmit={onSubmit}>
            {/* Honeypot field (hidden from users) */}
            <input
              type="text"
              name="company"
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />
            <input
              required
              name="name"
              placeholder="Name"
              className="form-field col-span-2 md:col-span-1 h-11 px-3 text-black"
            />
            <input
              required
              name="email"
              type="email"
              placeholder="Email"
              className="form-field col-span-2 md:col-span-1 h-11 px-3 text-black"
            />
            <input
              name="subject"
              placeholder="Subject"
              className="form-field col-span-2 h-11 px-3 text-black"
            />
            <textarea
              required
              name="message"
              placeholder="Message"
              className="form-field col-span-2 min-h-28 p-3 text-black"
            />
            <Button className="col-span-2" variant="secondary">
              {status === "sending"
                ? "Sending..."
                : status === "success"
                ? "Sent!"
                : "Send Inquiry"}
            </Button>
            {status === "error" && (
              <p className="col-span-2 text-sm text-red-600">{error}</p>
            )}
            {status === "success" && (
              <p className="col-span-2 text-sm text-green-600">
                Message sent successfully.
              </p>
            )}
          </form>
        </div>
      </section>

      {/* Footer moved to layout */}
    </main>
  );
}
