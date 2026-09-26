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


const contractor = doc([
  Title('INDEPENDENT CONTRACTOR AGREEMENT'),
  P('This Independent Contractor Agreement (the "Agreement") is made on {effective_date} between {client_name}, {client_address} (the "Client"), and {contractor_name}, {contractor_address} (the "Contractor").'),
  H('1. Services'),
  P('The Contractor will provide the following services (the "Services"): {services_description}. The Services begin on {start_date}{#has_end_date} and end on {end_date}{/has_end_date}{^has_end_date} and continue until either party ends this Agreement under section 6{/has_end_date}.'),
  H('2. Fees'),
  P('{#fee_hourly}The Client will pay the Contractor {hourly_rate} per hour for time spent on the Services{#has_hours_cap}, up to {hours_cap} hours per month unless the Client agrees otherwise in writing{/has_hours_cap}.{/fee_hourly}{#fee_fixed}The Client will pay the Contractor a fixed fee of {fixed_fee} for the Services.{/fee_fixed}'),
  P('The Contractor will invoice the Client {invoice_frequency}. Invoices are due within {payment_days} days of receipt.{#reimburse_expenses} The Client will reimburse reasonable, pre-approved expenses supported by receipts.{/reimburse_expenses}'),
  H('3. Independent contractor'),
  P('The Contractor is an independent contractor, not an employee, partner or agent of the Client. The Contractor decides how, when and where to perform the Services, provides their own equipment, and is responsible for their own taxes, insurance and benefits.'),
  H('4. Intellectual property'),
  P('{#client_owns_ip}All work product created by the Contractor for the Client under this Agreement belongs to the Client once paid for, and the Contractor assigns all rights in it to the Client.{/client_owns_ip}{^client_owns_ip}The Contractor keeps ownership of their work product and grants the Client a non-exclusive, perpetual licence to use it for the Client\'s business once paid for.{/client_owns_ip}'),
  H('5. Confidentiality'),
  P('The Contractor will keep the Client\'s non-public information confidential and use it only to perform the Services, during this Agreement and for {confidentiality_years} years afterwards.'),
  H('6. Termination'),
  P('Either party may end this Agreement with {notice_days} days\' written notice. The Client will pay for Services performed up to the end date.'),
  H('7. Governing law'),
  P('This Agreement is governed by the laws of {governing_law}.'),
  H('Signatures'),
  P('{client_name}'), P('By: ____________________________'), P('Name: {client_signatory}'), P(''),
  P('{contractor_name}'), P('Signature: ____________________________'),
]);

const sow = doc([
  Title('STATEMENT OF WORK'),
  P('Statement of Work number {sow_number}, dated {sow_date}, under the agreement between {client_name} (the "Client") and {provider_name} (the "Provider") dated {agreement_date}.'),
  H2('Project'),
  P('{project_name}: {project_summary}'),
  H2('Deliverables'),
  new Paragraph({ children: [new TextRun('{#deliverables}')] }),
  Bullet('{title}: {description} (due {due_date})'),
  new Paragraph({ children: [new TextRun('{/deliverables}')] }),
  H2('Timeline'),
  P('Work starts on {start_date} and is expected to finish by {end_date}.'),
  H2('Fees'),
  P('{#fixed_price}The total fixed price for this Statement of Work is {total_price}, invoiced {invoice_schedule}.{/fixed_price}{^fixed_price}Work is billed on a time-and-materials basis at {hourly_rate} per hour, with an estimated total of {estimated_total}.{/fixed_price}'),
  H2('Assumptions'),
  P('{assumptions}'),
  H2('Acceptance'),
  P('The Client will review each deliverable within {review_days} business days of delivery and either accept it or describe the changes needed.'),
  P(''),
  P('Accepted for {client_name}: ____________________________  Date: ______________'),
  P('Accepted for {provider_name}: ____________________________  Date: ______________'),
]);

const verification = doc([
  Title('EMPLOYMENT VERIFICATION LETTER'),
  P('{letter_date}'),
  P('To whom it may concern,'),
  P('This letter confirms that {employee_name} {#is_current}is employed{/is_current}{^is_current}was employed{/is_current} by {company_name} as {job_title}{#is_current} since {start_date}{/is_current}{^is_current} from {start_date} to {end_date}{/is_current}.'),
  P('{employee_first_name} {#is_current}works{/is_current}{^is_current}worked{/is_current} on a {employment_type} basis.'),
  P('{#include_salary}{employee_first_name}\'s current annual base salary is {salary}.{/include_salary}'),
  P('This letter is provided at the employee\'s request{#has_purpose} for the purpose of {purpose}{/has_purpose}. For further verification, please contact {contact_name} at {contact_email}.'),
  P('Sincerely,'), P('{signatory_name}'), P('{signatory_title}, {company_name}'),
]);

const demand = doc([
  Title('DEMAND FOR PAYMENT'),
  P('{letter_date}'),
  P('{debtor_name}'), P('{debtor_address}'),
  P('Re: Outstanding balance of {amount_due}{#has_invoice_number} (invoice {invoice_number}){/has_invoice_number}'),
  P('Dear {debtor_salutation},'),
  P('Our records show that {amount_due} for {goods_or_services} provided by {creditor_name} was due on {due_date} and remains unpaid.'),
  P('Please pay the full amount by {pay_by_date}. {payment_instructions}'),
  P('{#charges_interest}Under the terms agreed between us, interest of {interest_rate} is being added to the overdue balance.{/charges_interest}'),
  P('If you have already paid, please disregard this letter and send us the payment details so we can update our records. If you believe the amount is not owed, or you would like to agree a payment plan, please contact {contact_name} at {contact_email} before {pay_by_date}.'),
  P('{#mention_next_steps}If we do not receive payment or hear from you by that date, we may take further steps to recover the debt, which may include {next_steps}.{/mention_next_steps}'),
  P('Sincerely,'), P('{contact_name}'), P('{creditor_name}'),
]);


const unilateralNda = doc([
  Title('NON-DISCLOSURE AGREEMENT'),
  P('This Non-Disclosure Agreement (the "Agreement") is made on {effective_date} between {discloser_name}, {discloser_address} (the "Disclosing Party"), and {recipient_name}, {recipient_address} (the "Receiving Party").'),
  H('1. Purpose'),
  P('The Disclosing Party will share confidential information with the Receiving Party for the purpose of {purpose} (the "Purpose").'),
  H('2. Confidential Information'),
  P('"Confidential Information" means all non-public information the Disclosing Party shares in connection with the Purpose, in any form, that is marked confidential or that a reasonable person would understand to be confidential. It does not include information that is or becomes public through no fault of the Receiving Party, that the Receiving Party already lawfully knew, or that it develops independently.'),
  H('3. Obligations of the Receiving Party'),
  Numbered('Use the Confidential Information only for the Purpose.'),
  Numbered('Not disclose it to anyone except its employees and advisers who need to know it and are bound by similar confidentiality duties.'),
  Numbered('Protect it with at least reasonable care.'),
  Numbered('Return or destroy it on request{#certify_destruction} and confirm in writing that it has done so{/certify_destruction}.'),
  H('4. Term'),
  P('The obligations in this Agreement last for {term_years} years from the date above.'),
  H('5. No licence'),
  P('Nothing in this Agreement grants the Receiving Party any rights in the Confidential Information other than to use it for the Purpose.'),
  H('6. Governing law'),
  P('This Agreement is governed by the laws of {governing_law}.'),
  H('Signatures'),
  P('{discloser_name}'), P('By: ____________________________'), P('Name and title: {discloser_signatory}'), P(''),
  P('{recipient_name}'), P('By: ____________________________'), P('Name and title: {recipient_signatory}'),
]);

const consulting = doc([
  Title('CONSULTING AGREEMENT'),
  P('This Consulting Agreement is made on {effective_date} between {client_name} (the "Client") and {consultant_name} (the "Consultant").'),
  H('1. Engagement'),
  P('The Client engages the Consultant to provide advice and services relating to {engagement_scope} (the "Services"), starting on {start_date}.'),
  H('2. Deliverables'),
  new Paragraph({ children: [new TextRun('{#deliverables}')] }),
  Bullet('{title} by {due_date}'),
  new Paragraph({ children: [new TextRun('{/deliverables}')] }),
  H('3. Fees'),
  P('{#monthly_retainer}The Client will pay a monthly retainer of {retainer_amount}, invoiced in advance at the start of each month.{/monthly_retainer}{^monthly_retainer}The Client will pay {daily_rate} per day of Services, invoiced monthly in arrears.{/monthly_retainer} Invoices are payable within {payment_days} days.'),
  H('4. Relationship'),
  P('The Consultant is an independent contractor and is responsible for their own taxes, insurance and working arrangements.'),
  H('5. Confidentiality and ownership'),
  P('The Consultant will keep the Client\'s confidential information secret. Reports and materials produced specifically for the Client belong to the Client once paid for; the Consultant keeps their pre-existing know-how, methods and tools.'),
  H('6. Term and termination'),
  P('This Agreement continues until {end_date} unless either party ends it earlier with {notice_days} days\' written notice.'),
  H('7. Governing law'),
  P('This Agreement is governed by the laws of {governing_law}.'),
  P(''), P('{client_name}: ____________________________'), P('{consultant_name}: ____________________________'),
]);

const termination = doc([
  Title('NOTICE OF TERMINATION OF EMPLOYMENT'),
  P('{letter_date}'),
  P('{employee_name}'), P('{employee_address}'),
  P('Dear {employee_first_name},'),
  P('This letter confirms that your employment with {company_name} as {job_title} will end on {termination_date}.'),
  P('{#has_reason}The reason for this decision is {termination_reason}.{/has_reason}'),
  P('{#notice_pay}You will receive pay in lieu of notice for {notice_period}.{/notice_pay}{^notice_pay}Your notice period is {notice_period}{#garden_leave}, and you will not be required to work during it{/garden_leave}.{/notice_pay}'),
  P('Your final pay, including any accrued but unused paid time off, will be paid on {final_pay_date}.{#has_severance} In addition, you will receive a severance payment of {severance_amount}, subject to the terms set out in a separate agreement.{/has_severance}'),
  P('Please return all company property, including {property_to_return}, by {return_by_date}.'),
  P('{#benefits_info}Information about your benefits after your employment ends, including any continuation options, will be sent to you separately.{/benefits_info}'),
  P('If you have questions, please contact {hr_contact_name} at {hr_contact_email}.'),
  P('Sincerely,'), P('{signatory_name}'), P('{signatory_title}, {company_name}'),
]);

const reference = doc([
  Title('LETTER OF REFERENCE'),
  P('{letter_date}'),
  P('To whom it may concern,'),
  P('I am pleased to provide this reference for {candidate_name}, who worked with me at {company_name} as {job_title} from {start_date} to {end_date}. I was {relationship} during this time.'),
  P('{candidate_first_name}\'s main responsibilities included {responsibilities}.'),
  P('{#has_strengths}In my experience, {candidate_first_name}\'s particular strengths are:{/has_strengths}'),
  new Paragraph({ children: [new TextRun('{#strengths}')] }),
  Bullet('{strength}'),
  new Paragraph({ children: [new TextRun('{/strengths}')] }),
  P('{#include_recommendation}I recommend {candidate_first_name} without reservation for {target_role}.{/include_recommendation}'),
  P('Please feel free to contact me at {referee_email}{#has_phone} or {referee_phone}{/has_phone} if you would like to discuss this further.'),
  P('Yours faithfully,'), P('{referee_name}'), P('{referee_title}, {company_name}'),
]);

const raise = doc([
  Title('SALARY INCREASE LETTER'),
  P('{letter_date}'),
  P('Dear {employee_first_name},'),
  P('I am pleased to confirm that your annual base salary will increase from {current_salary} to {new_salary}, effective {effective_date}.'),
  P('{#has_reason}This increase recognises {increase_reason}.{/has_reason}'),
  P('{#has_title_change}Your job title will also change to {new_job_title} from the same date.{/has_title_change}'),
  P('All other terms of your employment remain unchanged. The new salary will appear in your pay from {first_pay_date}.'),
  P('Thank you for your continued contribution to {company_name}.'),
  P('Kind regards,'), P('{signatory_name}'), P('{signatory_title}'),
]);

const internship = doc([
  Title('INTERNSHIP OFFER'),
  P('{offer_date}'),
  P('Dear {candidate_first_name},'),
  P('We are pleased to offer you an internship as {internship_title} in our {team_name} team at {company_name}, starting on {start_date} and ending on {end_date}.'),
  P('{#is_paid}You will be paid {pay_rate} {pay_basis}.{/is_paid}{^is_paid}This is an unpaid internship{#has_stipend}, with a stipend of {stipend_amount} towards expenses{/has_stipend}.{/is_paid}'),
  P('You will work {hours_per_week} hours per week{#is_remote}, remotely{/is_remote}{^is_remote}, at our {office_location} office{/is_remote}. Your supervisor will be {supervisor_name}.'),
  P('During the internship you will work on {learning_objectives}.'),
  P('{#academic_credit}We will provide any documentation your school requires for academic credit.{/academic_credit}'),
  P('Please confirm your acceptance by {response_deadline}.'),
  P('Welcome aboard,'), P('{signatory_name}'), P('{signatory_title}, {company_name}'),
]);

const service = doc([
  Title('SERVICE AGREEMENT'),
  P('This Service Agreement is made on {effective_date} between {provider_name} (the "Provider") and {customer_name} (the "Customer").'),
  H('1. Services'),
  P('The Provider will provide the following services: {services_description}.'),
  new Paragraph({ children: [new TextRun('{#service_items}')] }),
  Bullet('{item}: {price}'),
  new Paragraph({ children: [new TextRun('{/service_items}')] }),
  H('2. Payment'),
  P('The Customer will pay the Provider\'s invoices within {payment_days} days.{#late_fee} Late payments incur a fee of {late_fee_terms}.{/late_fee}{#deposit_required} A deposit of {deposit_amount} is payable on signing.{/deposit_required}'),
  H('3. Term'),
  P('This Agreement starts on {start_date} and {#auto_renews}renews automatically every {renewal_period} unless either party gives {notice_days} days\' notice.{/auto_renews}{^auto_renews}ends on {end_date}.{/auto_renews}'),
  H('4. Standard of work'),
  P('The Provider will perform the services with reasonable skill and care. The Customer will provide the access and information the Provider reasonably needs.'),
  H('5. Liability'),
  P('Each party\'s total liability under this Agreement is limited to the fees paid in the twelve months before the claim, except where the law does not allow liability to be limited.'),
  H('6. Governing law'),
  P('This Agreement is governed by the laws of {governing_law}.'),
  P(''), P('{provider_name}: ____________________________'), P('{customer_name}: ____________________________'),
]);

const cease = doc([
  Title('CEASE AND DESIST'),
  P('{letter_date}'),
  P('{recipient_name}'), P('{recipient_address}'),
  P('Dear {recipient_salutation},'),
  P('We write on behalf of {sender_name} regarding {conduct_description}.'),
  P('{sender_name} {#is_ip_claim}owns the rights in {protected_work}, and this conduct infringes those rights.{/is_ip_claim}{^is_ip_claim}considers this conduct to be unlawful and harmful to its interests.{/is_ip_claim}'),
  P('We ask that you:'),
  new Paragraph({ children: [new TextRun('{#demands}')] }),
  Bullet('{demand}'),
  new Paragraph({ children: [new TextRun('{/demands}')] }),
  P('Please confirm in writing by {response_deadline} that you have done so.'),
  P('{#reserve_rights}If we do not receive a satisfactory response by that date, {sender_name} reserves all of its rights and remedies.{/reserve_rights}'),
  P('Nothing in this letter waives any of {sender_name}\'s rights, all of which are expressly reserved.'),
  P('Sincerely,'), P('{signatory_name}'), P('{signatory_title}'),
]);

const promissory = doc([
  Title('PROMISSORY NOTE'),
  P('Principal amount: {principal_amount}        Date: {note_date}'),
  P('For value received, {borrower_name} of {borrower_address} (the "Borrower") promises to pay {lender_name} of {lender_address} (the "Lender") the principal amount above{#charges_interest}, with interest at {interest_rate} per year{/charges_interest}.'),
  H2('Repayment'),
  P('{#pay_in_installments}The Borrower will repay the loan in {installment_count} {installment_frequency} instalments of {installment_amount}, starting on {first_payment_date}.{/pay_in_installments}{^pay_in_installments}The Borrower will repay the full amount{#charges_interest} with interest{/charges_interest} on or before {maturity_date}.{/pay_in_installments}'),
  H2('Prepayment'),
  P('The Borrower may repay all or part of the loan early without penalty.'),
  H2('Default'),
  P('If any payment is more than {grace_days} days late, the Lender may demand immediate payment of the full outstanding balance.'),
  H2('Governing law'),
  P('This note is governed by the laws of {governing_law}.'),
  P(''), P('Borrower: ____________________________  {borrower_name}'),
  P('{#has_witness}Witness: ____________________________  {witness_name}{/has_witness}'),
]);

const resignation = doc([
  Title('LETTER OF RESIGNATION'),
  P('{letter_date}'),
  P('Dear {manager_name},'),
  P('Please accept this letter as formal notice of my resignation from my position as {job_title} at {company_name}. My last working day will be {last_day}{#standard_notice}, in line with my notice period of {notice_period}{/standard_notice}.'),
  P('{#has_reason}I have decided to {resignation_reason}.{/has_reason}'),
  P('{#offer_handover}I will do everything I can to ensure a smooth handover, including {handover_plan}.{/offer_handover}'),
  P('{#thank}Thank you for the opportunities I have had during my time here. I have particularly valued {appreciation}.{/thank}'),
  P('Yours sincerely,'), P('{employee_name}'),
]);

mkdirSync('samples', { recursive: true });
for (const [file, d] of [['mutual-nda.docx', nda], ['engagement-letter.docx', engagement], ['offer-letter.docx', offer], ['independent-contractor-agreement.docx', contractor], ['statement-of-work.docx', sow], ['employment-verification-letter.docx', verification], ['payment-demand-letter.docx', demand], ['one-way-nda.docx', unilateralNda], ['consulting-agreement.docx', consulting], ['employment-termination-letter.docx', termination], ['reference-letter.docx', reference], ['salary-increase-letter.docx', raise], ['internship-offer-letter.docx', internship], ['service-agreement.docx', service], ['cease-and-desist-letter.docx', cease], ['promissory-note.docx', promissory], ['resignation-letter.docx', resignation]]) {
  writeFileSync(`samples/${file}`, await deterministic(await Packer.toBuffer(d)));
  console.log('wrote samples/' + file);
}
