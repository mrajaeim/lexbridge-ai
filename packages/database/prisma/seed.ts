import { DocumentStatus, OrgRole } from '@prisma/client';
import { chunkText } from '@lexbridge/shared';
import { createPrismaClient } from '../src/create-prisma-client';

const prisma = createPrismaClient();

const DISCLAIMER = 'Synthetic sample for a technical prototype. Not legal advice.';

type SeedDoc = {
  org: 'firm-alpha' | 'firm-beta';
  title: string;
  body: string;
};

const documents: SeedDoc[] = [
  {
    org: 'firm-alpha',
    title: 'Harbor Services Agreement',
    body: `${DISCLAIMER} The Harbor Services Agreement requires a written notice period of thirty days before either party may terminate for convenience. Notices must be sent to the registered address of the counterparty. The agreement is governed by the fictional Harbor Contract Code.`,
  },
  {
    org: 'firm-alpha',
    title: 'Northwind Lease Summary',
    body: `${DISCLAIMER} Under the Northwind lease summary, base rent is due on the first business day of each month. The tenant must maintain insurance naming the landlord as an additional insured. Late rent accrues a flat administrative charge described in schedule A.`,
  },
  {
    org: 'firm-alpha',
    title: 'Cedar Indemnity Clause',
    body: `${DISCLAIMER} The Cedar indemnity clause uses mutual indemnity for third-party claims arising from a party's negligence. Indemnity does not cover losses caused by the indemnified party's own willful misconduct. Defense costs are included in the indemnity.`,
  },
  {
    org: 'firm-alpha',
    title: 'Example Confidentiality Note',
    body: `${DISCLAIMER} Confidential information under this note must be protected for three years after disclosure. Residuals retained in unaided memory are excluded. The receiving party may share information with professional advisers who are bound by confidentiality duties.`,
  },
  {
    org: 'firm-alpha',
    title: 'Fictional Arbitration Rules',
    body: `${DISCLAIMER} Disputes under the fictional arbitration rules are seated in Amsterdam. The tribunal consists of three arbitrators when the amount in controversy exceeds a stated threshold. The language of the arbitration is English.`,
  },
  {
    org: 'firm-alpha',
    title: 'Sample Employment Addendum',
    body: `${DISCLAIMER} The sample employment addendum provides garden leave of two weeks after notice of resignation. The employee must return devices on the last working day. Restrictive covenants last for six months within the same city.`,
  },
  {
    org: 'firm-alpha',
    title: 'Prototype Data Processing Schedule',
    body: `${DISCLAIMER} The prototype data processing schedule states that customer content is stored in the European Union. Subprocessors are listed in an appendix and require prior written notice before replacement. Deletion is completed within thirty days after contract end.`,
  },
  {
    org: 'firm-alpha',
    title: 'Amber Warranty Statement',
    body: `${DISCLAIMER} The Amber warranty statement gives a twelve month warranty that deliverables materially match the specification. The sole remedy is repair or replacement. The warranty excludes modifications made by the customer.`,
  },
  {
    org: 'firm-alpha',
    title: 'Quay Limitation of Liability',
    body: `${DISCLAIMER} The Quay limitation of liability caps aggregate damages at the fees paid in the twelve months before the claim. The cap does not apply to bodily injury or to fraud. Consequential damages are excluded.`,
  },
  {
    org: 'firm-alpha',
    title: 'Linden Termination Playbook',
    body: `${DISCLAIMER} The Linden termination playbook grants a cure period of ten days after written notice of a material breach. If the breach is not cured, the non-breaching party may terminate. Survival clauses include confidentiality and liability limits.`,
  },
  {
    org: 'firm-alpha',
    title: 'Sample Opinion Memorandum',
    body: `${DISCLAIMER} This sample opinion memorandum discusses the Harbor Services Agreement only. It concludes that a convenience termination requires thirty days of prior written notice. It does not evaluate any real client facts.`,
  },
  {
    org: 'firm-alpha',
    title: 'Brook Assignment Clause',
    body: `${DISCLAIMER} The Brook assignment clause prohibits assignment without prior written consent, except to an affiliate. A change of control is treated as an assignment. Any attempted assignment in breach is void.`,
  },
  {
    org: 'firm-beta',
    title: 'Zephyr Quill Merger',
    body: `${DISCLAIMER} BETA-CONFIDENTIAL-MARKER. The Zephyr Quill merger discussion is private to Firm Beta. zephyrquill appears only in this document. It describes a fictional all-stock combination and a breakup fee.`,
  },
  {
    org: 'firm-beta',
    title: 'Beta Compensation Grid',
    body: `${DISCLAIMER} BETA-ONLY-SALARY-GRID. This compensation grid is internal to Firm Beta and lists fictional bonus bands for partners. It is not shared with Firm Alpha.`,
  },
  {
    org: 'firm-beta',
    title: 'Beta Board Minutes',
    body: `${DISCLAIMER} BETA-BOARD-PRIVATE. These fictional board minutes record that Firm Beta postponed a vote on new office space. They are organization-private records.`,
  },
];

const people: Array<{ email: string; name: string; slug: string; role: OrgRole }> = [
  { email: 'alice@alpha.example', name: 'Alice Chen', slug: 'firm-alpha', role: OrgRole.ADMIN },
  { email: 'bob@alpha.example', name: 'Bob Okonkwo', slug: 'firm-alpha', role: OrgRole.EDITOR },
  { email: 'carol@alpha.example', name: 'Carol Nguyen', slug: 'firm-alpha', role: OrgRole.READER },
  { email: 'david@beta.example', name: 'David Patel', slug: 'firm-beta', role: OrgRole.ADMIN },
  { email: 'emma@beta.example', name: 'Emma Rossi', slug: 'firm-beta', role: OrgRole.READER },
];

async function main(): Promise<void> {
  const alpha = await prisma.organization.upsert({
    where: { slug: 'firm-alpha' },
    update: { name: 'Firm Alpha' },
    create: { name: 'Firm Alpha', slug: 'firm-alpha' },
  });
  const beta = await prisma.organization.upsert({
    where: { slug: 'firm-beta' },
    update: { name: 'Firm Beta' },
    create: { name: 'Firm Beta', slug: 'firm-beta' },
  });
  const orgs = { 'firm-alpha': alpha, 'firm-beta': beta };

  const users = new Map<string, { id: string }>();
  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, emailVerified: true },
      create: { email: person.email, name: person.name, emailVerified: true },
    });
    users.set(person.email, user);
    const org = orgs[person.slug as 'firm-alpha' | 'firm-beta'];
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { role: person.role },
      create: { userId: user.id, organizationId: org.id, role: person.role },
    });
  }

  await prisma.document.deleteMany({
    where: { organizationId: { in: [alpha.id, beta.id] } },
  });

  for (const doc of documents) {
    const org = orgs[doc.org];
    const authorEmail = doc.org === 'firm-alpha' ? 'alice@alpha.example' : 'david@beta.example';
    const author = users.get(authorEmail);
    if (!author) throw new Error(`Missing author ${authorEmail}`);
    const created = await prisma.document.create({
      data: {
        organizationId: org.id,
        title: doc.title,
        body: doc.body,
        status: DocumentStatus.PUBLISHED,
        createdById: author.id,
      },
    });
    const chunks = chunkText(doc.body);
    await prisma.documentChunk.createMany({
      data: chunks.map((content, ordinal) => ({
        documentId: created.id,
        organizationId: org.id,
        ordinal,
        content,
      })),
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
