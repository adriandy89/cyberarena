// One-off E2E for the certificate PDF (spec 106 T2). DELETE AFTER USE.
// Creates a user via API, completes the shortest path by inserting
// QuestionSolved rows, then verifies the certificates + PDF endpoints.
import { writeFileSync as _wf } from 'node:fs';
import { PrismaClient } from './src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const API = 'http://127.0.0.1:3001';
const email = `cert-test-${Date.now()}@cyberarena.test`;
const password = 'CertTest-123-pass';

async function main() {
  const signup = await fetch(`${API}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ name: 'Cert Tester', email, password }),
  });
  if (!signup.ok) throw new Error('signup failed: ' + (await signup.text()));

  const signin = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (signin.headers.get('set-cookie') ?? '').split(';')[0]!;
  console.log('user:', email);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const path = await prisma.catalogPath.findUnique({
    where: { slug: 'advanced-pentesting' },
    include: { modules: { include: { rooms: { include: { tasks: { include: { questions: true } } } } } } },
  });
  const qids = path!.modules.flatMap((m) =>
    m.rooms.flatMap((r) => r.tasks.flatMap((t) => t.questions.map((q) => q.id))),
  );
  console.log('questions in path:', qids.length);

  const user = await prisma.user.findUnique({ where: { email } });
  const solvedAt = new Date();
  await prisma.questionSolved.createMany({
    data: qids.map((questionId) => ({ userId: user!.id, questionId, solvedAt })),
    skipDuplicates: true,
  });

  const certs = await (await fetch(`${API}/api/me/certificates`, { headers: { cookie } })).json();
  console.log('certificates:', JSON.stringify(certs.map((c: { pathSlug: string }) => c.pathSlug)));

  const pdf = await fetch(`${API}/api/me/certificates/advanced-pentesting/pdf?locale=es`, {
    headers: { cookie },
  });
  console.log('PDF ES:', pdf.status, pdf.headers.get('content-type'), '|', pdf.headers.get('content-disposition'));
  const buf = Buffer.from(await pdf.arrayBuffer());
  console.log('magic:', buf.subarray(0, 5).toString(), '| bytes:', buf.length);
  _wf('D:/WORK/PERSONAL/tryhackme/cert-preview-es.pdf', buf);

  const pdfEn = await fetch(`${API}/api/me/certificates/advanced-pentesting/pdf?locale=en`, {
    headers: { cookie },
  });
  console.log('PDF EN:', pdfEn.status, '| bytes:', (await pdfEn.arrayBuffer()).byteLength);

  const noCert = await fetch(`${API}/api/me/certificates/cyber-security-101/pdf`, {
    headers: { cookie },
  });
  console.log('uncompleted path (expect 404):', noCert.status);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
// (visual check: the main() above already ran; this stub keeps the file single-purpose)
