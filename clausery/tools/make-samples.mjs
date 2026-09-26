// Generates the sample .docx templates shipped in samples/ (run with `npm run build:samples`).
// Each template uses plain docxtemplater tags: {field}, {#section}...{/section}, {^section}...{/section}, {#list}{item}{/list}.
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { writeFileSync, mkdirSync } from 'node:fs';
import JSZip from 'jszip';

// Fixed timestamps make the output byte-for-byte reproducible, so rebuilding never dirties the tracked samples.
const FIXED_DATE = new Date('2026-09-24T00:00:00Z');
async function deterministic(buffer) {
  const src = await JSZip.loadAsync(buffer);
  const out = new JSZip();
  for (const name of Object.keys(src.files).sort()) {
    const entry = src.files[name];
    if (entry.dir) continue;
    let data = await entry.async('nodebuffer');
    if (name === 'docProps/core.xml') data = Buffer.from(data.toString('utf8').replace(/(<dcterms:(?:created|modified)[^>]*>)[^<]*(<\/dcterms:)/g, '$1' + FIXED_DATE.toISOString().replace(/\.\d+Z$/, 'Z') + '$2'));
    out.file(name, data, { date: FIXED_DATE, createFolders: false });
  }
  return out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', platform: 'UNIX' });
}

const P = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 160 } });
const H = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 160 } });
const H2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } });
const Title = (text) => new Paragraph({ text, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 240 } });
const Numbered = (text) => new Paragraph({ children: [new TextRun(text)], numbering: { reference: 'clauses', level: 0 }, spacing: { after: 120 } });
const Bullet = (text) => new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 }, spacing: { after: 80 } });

function doc(children) {
  return new Document({
    creator: 'Clausery', description: 'Clausery sample template',
    numbering: { config: [{ reference: 'clauses', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }] }] },
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: {}, children }],
  });
}

const nda = doc([
  Title('MUTUAL NON-DISCLOSURE AGREEMENT'),
  P('This Mutual Non-Disclosure Agreement (the "Agreement") is entered into on {effective_date} between {party_a_name}, a {party_a_entity} with its principal place of business at {party_a_address} ("{party_a_short}"), and {party_b_name}, a {party_b_entity} with its principal place of business at {party_b_address} ("{party_b_short}"). Each is a "Party" and together the "Parties".'),
  H('1. Purpose'),
  P('The Parties wish to explore {purpose} (the "Purpose") and, in connection with the Purpose, each Party may disclose Confidential Information to the other.'),
  H('2. Confidential Information'),
  P('"Confidential Information" means all non-public information disclosed by either Party in connection with the Purpose, whether disclosed orally, in writing or by inspection, that is designated as confidential or that reasonably should be understood to be confidential.'),
  P('{#has_carveouts}Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the receiving Party; (b) was rightfully known to the receiving Party before disclosure; (c) is independently developed without use of the disclosing Party\'s Confidential Information; or (d) is rightfully obtained from a third party without restriction.{/has_carveouts}'),
  H('3. Obligations'),
  Numbered('The receiving Party shall use the Confidential Information solely for the Purpose.'),
  Numbered('The receiving Party shall protect the Confidential Information using at least the same degree of care it uses for its own confidential information, and no less than reasonable care.'),
  Numbered('The receiving Party shall restrict disclosure to those of its employees and advisers who need to know and who are bound by obligations at least as protective as this Agreement.'),
  H('4. Term'),
  P('This Agreement is effective from the date first written above and continues for {term_years} years. The obligations of confidentiality survive for {survival_years} years after expiry or termination.'),
  H('5. Governing Law'),
  P('This Agreement is governed by the laws of {governing_law}. {#has_jurisdiction}The courts of {jurisdiction} have exclusive jurisdiction over any dispute arising out of this Agreement.{/has_jurisdiction}'),
  H('6. Notices'),
  P('Notices must be sent to the addresses above{#has_notice_email} and copied by email to {party_a_email} and {party_b_email}{/has_notice_email}.'),
  H('Signatures'),
  P('{party_a_name}'), P('By: ____________________________'), P('Name: {party_a_signatory}'), P('Title: {party_a_signatory_title}'),
  P(''),
  P('{party_b_name}'), P('By: ____________________________'), P('Name: {party_b_signatory}'), P('Title: {party_b_signatory_title}'),
]);

const engagement = doc([
  Title('ENGAGEMENT LETTER'),
  P('{letter_date}'),
  P('{client_name}'), P('{client_address}'),
  P('Re: {matter_description}'),
  P('Dear {client_salutation},'),
  P('Thank you for choosing {firm_name} (the "Firm") to represent you. This letter confirms the terms of our engagement.'),
  H2('Scope of services'),
  P('The Firm will represent {client_name} in connection with {matter_description} (the "Matter"). Our engagement is limited to the Matter and does not include any other legal work unless agreed in writing.'),
  H2('Team'),
  P('The following attorneys are expected to work on the Matter:'),
  new Paragraph({ children: [new TextRun('{#attorneys}')] }),
  Bullet('{name}, {role} — {rate} per hour'),
  new Paragraph({ children: [new TextRun('{/attorneys}')] }),
  H2('Fees'),
  P('{#fee_hourly}Our fees are based on the time spent on the Matter at the hourly rates listed above, billed in increments of one tenth of an hour.{/fee_hourly}{#fee_flat}Our fee for the Matter is a flat fee of {flat_fee}, payable {flat_fee_terms}.{/fee_flat}'),
  P('{#has_retainer}Before we begin work, we require an advance fee deposit (retainer) of {retainer_amount}, which will be held in our client trust account and applied to invoices as they are issued.{/has_retainer}{^has_retainer}No advance deposit is required for this Matter.{/has_retainer}'),
  H2('Costs and billing'),
  P('You agree to reimburse the Firm for costs incurred on your behalf, including filing fees, court reporter fees and travel. Invoices are issued monthly and are due within {payment_days} days.'),
  H2('Termination'),
  P('You may terminate this engagement at any time by written notice. The Firm may withdraw as permitted by the applicable rules of professional conduct.'),
  P('If these terms are acceptable, please sign and return a copy of this letter.'),
  P('Sincerely,'), P('{responsible_attorney}'), P('{firm_name}'),
  P(''),
  P('AGREED AND ACCEPTED:'), P('____________________________'), P('{client_name}'), P('Date: ______________'),
]);

const offer = doc([
  Title('OFFER OF EMPLOYMENT'),
  P('{offer_date}'),
  P('Dear {candidate_first_name},'),
  P('We are delighted to offer you the position of {job_title} at {company_name} (the "Company"), reporting to {manager_name}, {manager_title}. {#is_remote}This is a remote position.{/is_remote}{^is_remote}You will be based at our {office_location} office.{/is_remote}'),
  H2('Start date'),
  P('Your anticipated start date is {start_date}, subject to the conditions below.'),
  H2('Compensation'),
  P('Your {pay_basis} salary will be {salary}, paid in accordance with the Company\'s standard payroll schedule and subject to applicable withholdings.'),
  P('{#has_bonus}You will be eligible for a discretionary annual bonus with a target of {bonus_target} of your base salary, based on Company and individual performance.{/has_bonus}'),
  P('{#has_equity}Subject to approval by the board of directors, you will be granted {equity_amount} under the Company\'s equity incentive plan, vesting over {vesting_years} years with a one-year cliff.{/has_equity}'),
  H2('Benefits'),
  P('You will be eligible for the following benefits, subject to the terms of each plan:'),
  new Paragraph({ children: [new TextRun('{#benefits}')] }),
  Bullet('{item}'),
  new Paragraph({ children: [new TextRun('{/benefits}')] }),
  P('You will accrue {pto_days} days of paid time off per year.'),
  H2('Conditions'),
  P('This offer is contingent on {#has_background_check}satisfactory completion of a background check and {/has_background_check}proof of your eligibility to work in {work_country}. Employment is {employment_terms}.'),
  P('Please confirm your acceptance by signing below and returning this letter by {response_deadline}.'),
  P('We look forward to working with you.'),
  P('Sincerely,'), P('{signatory_name}'), P('{signatory_title}, {company_name}'),
  P(''),
  P('ACCEPTED:'), P('____________________________'), P('{candidate_full_name}'), P('Date: ______________'),
]);

mkdirSync('samples', { recursive: true });
for (const [file, d] of [['mutual-nda.docx', nda], ['engagement-letter.docx', engagement], ['offer-letter.docx', offer]]) {
  writeFileSync(`samples/${file}`, await deterministic(await Packer.toBuffer(d)));
  console.log('wrote samples/' + file);
}
