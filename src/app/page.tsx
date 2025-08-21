import Image from "next/image";
import Button from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
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
              AD HOC International s.a.r.l is a contracting company specializing
              in civil works, fit-outs, and infrastructure projects. We combine
              craftsmanship with modern methods to deliver on time and on
              budget.
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
              <p className="text-balance leading-7">
                With years of experience in contracting, our multidisciplinary
                team manages projects from concept to handover. We adhere to
                rigorous quality standards and safety practices while staying
                responsive to client needs.
              </p>
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
                <li>Transparent timelines and budgets</li>
                <li>Skilled workforce and trusted partners</li>
                <li>Quality materials and finishes</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Projects removed from homepage; now a dedicated /projects page */}

      {/* Contact */}
      <section
        id="contact"
        className="section bg-[var(--brand-blue)] text-white"
      >
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl font-bold">Let’s work together</h2>
            <p className="mt-2 text-white/90">
              Send us your project details and we’ll get back within one
              business day.
            </p>
          </div>
          <form className="grid grid-cols-2 gap-3">
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
              Send Inquiry
            </Button>
          </form>
        </div>
      </section>

      <footer className="py-6 border-t border-black/10">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <span>© {new Date().getFullYear()} AD HOC International s.a.r.l</span>
        </div>
      </footer>
    </main>
  );
}
