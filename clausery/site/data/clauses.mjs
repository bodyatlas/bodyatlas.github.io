// Clause library content: plain-English explanations and sample wording for the clauses people search for most.
// Each entry becomes clauses/<slug>.html (site/clauses.mjs). `auto` shows the same clause with Clausery tags so the
// reader can see how the variable parts become questions. `templates` lists related free templates by LIB slug.
export const GROUPS = ['Risk and liability', 'Confidentiality and restrictions', 'Money', 'Work and ownership', 'Ending the contract', 'Law and disputes', 'Boilerplate', 'Employment'];

export const CLAUSES = [
  {
    slug: 'indemnification-clause', name: 'Indemnification clause', group: 'Risk and liability',
    what: 'An indemnity is a promise by one party to cover the other party\'s losses if a specified kind of claim arises, most often a claim by a third party caused by the first party\'s breach, negligence or infringement of someone else\'s intellectual property.',
    when: 'Use one wherever a party\'s mistakes could expose the other party to claims from outsiders: service and supply agreements, software and content licences, and contractor agreements where the contractor creates material the client will publish.',
    sample: `The Supplier shall indemnify, defend and hold harmless the Customer and its officers, employees and agents from and against all losses, damages, liabilities, costs and expenses (including reasonable legal fees) arising out of any third-party claim to the extent caused by (a) the Supplier's breach of this Agreement, (b) the negligence or wilful misconduct of the Supplier or its personnel, or (c) any allegation that the Deliverables infringe the intellectual property rights of a third party.

The Customer shall (i) notify the Supplier in writing promptly after becoming aware of the claim, (ii) allow the Supplier to control the defence and settlement of the claim, provided that no settlement that admits fault on the Customer's behalf may be made without the Customer's consent, and (iii) give the Supplier reasonable cooperation at the Supplier's expense.`,
    auto: `{indemnifying_party} shall indemnify, defend and hold harmless {indemnified_party} from and against all losses arising out of any third-party claim to the extent caused by {indemnifying_party}'s breach of this Agreement{#include_ip_indemnity} or by any allegation that the Deliverables infringe a third party's intellectual property rights{/include_ip_indemnity}.
{#is_mutual}
Each party gives the same indemnity to the other on reciprocal terms.
{/is_mutual}`,
    points: [
      ['Third-party claims or all losses?', 'An indemnity limited to third-party claims is the market norm. One that covers any loss "arising from" a breach can turn an ordinary breach-of-contract claim into an uncapped indemnity claim.'],
      ['"To the extent caused by"', 'This wording makes the indemnity proportionate, so a party does not pay for losses the other party caused itself.'],
      ['The claims procedure', 'Notice, control of the defence and consent to settlement are where indemnities succeed or fail in practice. Spell them out.'],
      ['Read it with the liability cap', 'Say clearly whether indemnities sit inside or outside the limitation of liability. Intellectual property indemnities are often uncapped; general ones usually are not.'],
    ],
    faq: [
      ['What is the difference between "indemnify" and "hold harmless"?', 'Many courts treat the two as meaning the same thing. Some read "hold harmless" as also protecting the indemnified party from claims by the indemnifying party itself. Using both, as most contracts do, avoids the argument.'],
      ['Is an indemnity limited by the limitation of liability clause?', 'Only if the contract says so. If the liability clause is silent about indemnities, the result depends on how a court reads the two clauses together, so state the position expressly.'],
    ],
    templates: ['service-agreement', 'independent-contractor-agreement', 'consulting-agreement'],
  },
  {
    slug: 'limitation-of-liability-clause', name: 'Limitation of liability clause', group: 'Risk and liability',
    what: 'A limitation of liability clause caps how much one party can recover from the other, and usually excludes whole categories of loss, such as lost profits and indirect or consequential damages.',
    when: 'Almost every commercial contract has one. It matters most for service providers and software vendors, whose fees are small compared with the losses a customer could claim if something goes wrong.',
    sample: `Nothing in this Agreement limits or excludes any liability that cannot be limited or excluded by law, including liability for fraud or for death or personal injury caused by negligence.

Subject to the paragraph above: (a) neither party shall be liable to the other for any indirect, special or consequential loss, or for any loss of profits, revenue, business, data or goodwill, however arising; and (b) each party's total aggregate liability arising out of or in connection with this Agreement, whether in contract, tort (including negligence), breach of statutory duty or otherwise, shall not exceed the total fees paid or payable under this Agreement in the twelve (12) months immediately preceding the event giving rise to the claim.`,
    auto: `Each party's total aggregate liability under this Agreement shall not exceed {#has_fee_based_cap}the fees paid or payable in the {cap_months} months before the event giving rise to the claim{/has_fee_based_cap}{^has_fee_based_cap}{liability_cap_amount}{/has_fee_based_cap}.`,
    points: [
      ['The size and basis of the cap', 'Twelve months of fees is common for services. A fixed amount gives certainty on a long contract; a multiple of fees suits higher-risk work.'],
      ['What is carved out', 'Typical carve-outs are fraud, death or personal injury, breach of confidentiality, data protection breaches, intellectual property indemnities and unpaid fees. Each one removes protection, so negotiate them one by one.'],
      ['Mutual or one-sided', 'A cap that only protects the supplier is common in standard terms but is often pushed back to a mutual cap in negotiation.'],
      ['Enforceability', 'Courts in many countries test limitation clauses for reasonableness or fairness, and consumer protection laws restrict them further. Very low caps are the most likely to fail.'],
    ],
    faq: [
      ['What is a typical liability cap?', 'In service agreements, the fees paid in the previous twelve months is the most common starting point. Higher-risk contracts often use a multiple of annual fees or a fixed amount linked to insurance cover.'],
      ['Can a contract exclude all liability?', 'Generally no. Most legal systems do not allow a party to exclude liability for fraud, and many prohibit excluding liability for death or personal injury caused by negligence. A clause that tries to exclude everything risks being struck down entirely.'],
    ],
    templates: ['service-agreement', 'consulting-agreement', 'statement-of-work'],
  },
  {
    slug: 'force-majeure-clause', name: 'Force majeure clause', group: 'Risk and liability',
    what: 'A force majeure clause excuses a party from performing, for as long as an extraordinary event outside its control prevents it: natural disasters, war, epidemics, government orders and similar events.',
    when: 'Use one in any contract with ongoing obligations, especially supply, services, events and construction work, where outside events could make performance impossible for a while.',
    sample: `Neither party shall be in breach of this Agreement or liable for any failure or delay in performing its obligations (other than an obligation to pay money) to the extent that the failure or delay results from an event beyond its reasonable control, including natural disaster, epidemic or pandemic, war, terrorism, riot, government action, fire, flood, or failure of public utilities or communications networks (a "Force Majeure Event").

The affected party shall promptly notify the other party of the Force Majeure Event and its likely duration, use reasonable efforts to mitigate its effect, and resume performance as soon as reasonably practicable. If a Force Majeure Event prevents performance for more than sixty (60) consecutive days, either party may terminate this Agreement by written notice.`,
    auto: `{#include_fm_termination}
If a Force Majeure Event prevents performance for more than {force_majeure_days} consecutive days, either party may terminate this Agreement by written notice.
{/include_fm_termination}`,
    points: [
      ['Name the events you care about', 'Courts read force majeure clauses narrowly. If epidemics, cyberattacks, supplier failure or government orders should count, list them.'],
      ['Carve out payment', 'Most clauses do not excuse paying money, because payment is rarely prevented by outside events.'],
      ['Notice and mitigation', 'A party that does not give notice or try to reduce the impact may lose the protection.'],
      ['A long-stop termination right', 'A contract suspended indefinitely helps nobody. Allow termination after a set period.'],
    ],
    faq: [
      ['Does force majeure cover pandemics?', 'Only if the wording covers it. Many older clauses did not mention epidemics or government lockdown orders, which led to disputes in 2020. Name them expressly if you want them covered.'],
      ['What happens if a contract has no force majeure clause?', 'You fall back on general law, such as frustration in England or impossibility and impracticability in the United States. Those doctrines are narrow and usually end the contract rather than suspending it.'],
    ],
    templates: ['service-agreement', 'consulting-agreement'],
  },
  {
    slug: 'confidentiality-clause', name: 'Confidentiality clause', group: 'Confidentiality and restrictions',
    what: 'A confidentiality clause obliges a party to keep the other party\'s non-public information secret, use it only for the purpose of the contract, and share it only with people who need to know it.',
    when: 'Include one in any contract where either side will see non-public information: services, consulting, employment, contractor and partnership agreements. When there is no other contract yet, a standalone NDA does the same job.',
    sample: `Each party (the "Recipient") shall keep confidential all information disclosed to it by the other party (the "Discloser") that is marked as confidential or would reasonably be understood to be confidential ("Confidential Information"). The Recipient shall use Confidential Information only to perform its obligations or exercise its rights under this Agreement, and shall disclose it only to its employees, officers, professional advisers and subcontractors who need to know it for that purpose and who are bound by confidentiality obligations no less protective than this clause.

These obligations do not apply to information that (a) is or becomes publicly available other than through the Recipient's breach, (b) was lawfully in the Recipient's possession before disclosure, (c) is lawfully received from a third party without restriction, or (d) is independently developed without use of the Confidential Information. The Recipient may disclose Confidential Information to the extent required by law or a court, after giving the Discloser prompt notice where legally permitted.

These obligations continue for three (3) years after this Agreement ends, and for trade secrets, for as long as the information remains a trade secret.`,
    auto: `{#include_standard_exclusions}
These obligations do not apply to information that is or becomes public other than through the Recipient's breach, was already lawfully known to the Recipient, or is independently developed.
{/include_standard_exclusions}
These obligations continue for {confidentiality_years} years after this Agreement ends.`,
    points: [
      ['What counts as confidential', '"Marked as confidential" is easy to prove but easy to forget. "Would reasonably be understood to be confidential" catches unmarked information, such as things said in meetings.'],
      ['The standard exclusions', 'Public information, information already known, information received from others and independent development are the four exclusions almost every clause includes.'],
      ['Duration', 'Two to five years is common for business information. Trade secrets are usually protected for as long as they stay secret.'],
      ['Whistleblowing and legal carve-outs', 'Many laws protect people who report wrongdoing to regulators, and a clause that tries to prevent that may be unenforceable. In the United States, employers must give employees and contractors a whistleblower immunity notice under the Defend Trade Secrets Act to recover certain damages.'],
    ],
    faq: [
      ['Is a confidentiality clause the same as an NDA?', 'It does the same job. An NDA is a standalone agreement, usually signed before a deal. A confidentiality clause sits inside a larger contract, such as a services or employment agreement.'],
      ['How long should confidentiality last?', 'Long enough for the information to lose its value. Two to five years suits most commercial information; trade secrets need protection for as long as they remain secret.'],
    ],
    templates: ['mutual-nda', 'one-way-nda', 'consulting-agreement', 'independent-contractor-agreement'],
  },
  {
    slug: 'non-solicitation-clause', name: 'Non-solicitation clause', group: 'Confidentiality and restrictions',
    what: 'A non-solicitation clause stops a party from actively approaching the other party\'s employees, contractors or customers for a period, usually during the contract and for a time after it ends.',
    when: 'Common in consulting, outsourcing and agency agreements, where one side\'s staff work closely with the other\'s, and in employment contracts to protect customer relationships.',
    sample: `During the term of this Agreement and for twelve (12) months after it ends, neither party shall, without the other party's prior written consent, directly or indirectly solicit or entice away, or attempt to solicit or entice away, any employee or contractor of the other party with whom it had material contact in connection with this Agreement.

This clause does not prevent either party from placing general advertisements that are not targeted at the other party's personnel, or from hiring any person who responds to such an advertisement without other solicitation.`,
    auto: `During the term of this Agreement and for {non_solicit_months} months after it ends, {#is_mutual}neither party{/is_mutual}{^is_mutual}{restricted_party}{/is_mutual} shall solicit any employee or contractor of the other party with whom it had material contact under this Agreement.`,
    points: [
      ['Staff, customers or both', 'Staff non-solicitation protects your team; customer non-solicitation protects revenue. They raise different enforceability issues, so draft them separately.'],
      ['Limit it to people who matter', '"Material contact" keeps the restriction proportionate, which makes it more likely to be enforced.'],
      ['Solicit or hire', 'A no-hire clause goes further than non-solicitation and is harder to justify. Competition authorities in several countries, including the United States, have treated no-poach agreements between competing employers as unlawful.'],
      ['Duration', 'Six to twelve months after the contract ends is typical.'],
    ],
    faq: [
      ['Is a non-solicitation clause enforceable?', 'It is enforced more often than a non-compete, provided it protects a legitimate interest and is reasonable in length and scope. Some places are stricter: California, for example, treats many customer non-solicitation clauses in employment contracts as void.'],
      ['What is the difference between non-solicitation and non-compete?', 'A non-compete stops someone working for a competitor at all. A non-solicitation clause only stops them approaching specific people, so it restricts far less and is easier to justify.'],
    ],
    templates: ['consulting-agreement', 'service-agreement', 'independent-contractor-agreement'],
  },
  {
    slug: 'non-compete-clause', name: 'Non-compete clause', group: 'Confidentiality and restrictions',
    what: 'A non-compete clause prevents a person or business from working for, or running, a competing business for a period and within an area after a relationship ends.',
    when: 'Mostly used in senior employment contracts and in the sale of a business, where the buyer pays for goodwill that the seller could otherwise take straight back.',
    sample: `For six (6) months after the Termination Date, the Employee shall not, within [the geographic area], be employed by, engaged by or provide services to any business that competes with the business of the Company in which the Employee was materially involved during the twelve (12) months before the Termination Date.

This restriction applies only to the extent reasonably necessary to protect the Company's confidential information, customer connections and goodwill.`,
    auto: `{#include_non_compete}
For {non_compete_months} months after the Termination Date, the Employee shall not, within {restricted_area}, provide services to any business that competes with the Company.
{/include_non_compete}`,
    points: [
      ['Check whether it is allowed at all', 'California, Minnesota, North Dakota and Oklahoma void most employee non-competes, and many other US states limit them by salary, notice or duration. Outside the US, courts usually require a legitimate interest and a restriction no wider than necessary, and some countries require the employer to pay during the restricted period.'],
      ['Keep it narrow', 'Tie the restriction to the business the person actually worked in, a realistic area and a short period. Wide clauses are the ones courts strike down.'],
      ['Consider something less drastic', 'A non-solicitation clause, strong confidentiality terms or garden leave often protect the same interests with less risk.'],
      ['Business sales are different', 'Courts are far more willing to enforce a seller\'s non-compete in the sale of a business, because the buyer paid for the goodwill.'],
    ],
    faq: [
      ['Are non-compete clauses legal?', 'It depends heavily on where you are. They are generally unenforceable against employees in California, Minnesota, North Dakota and Oklahoma, restricted in many other US states, and enforceable elsewhere only when reasonable. Take local advice before relying on one.'],
      ['How long can a non-compete last?', 'Six to twelve months is the range most often upheld for employees. Longer periods are usually only accepted in the sale of a business.'],
    ],
    templates: ['offer-letter', 'consulting-agreement'],
  },
  {
    slug: 'payment-terms-clause', name: 'Payment terms clause', group: 'Money',
    what: 'The payment terms clause says when a party can invoice, how long the other party has to pay, in what currency and by what method, and what happens when an invoice is disputed.',
    when: 'Every contract where money changes hands. Vague payment terms are one of the most common causes of cash-flow problems for small businesses.',
    sample: `The Supplier shall invoice the Customer monthly in arrears for the Services performed in the previous month. The Customer shall pay each invoice within thirty (30) days of the date of receipt, in US dollars, by bank transfer to the account specified on the invoice.

If the Customer disputes any part of an invoice in good faith, it shall notify the Supplier in writing within ten (10) days of receipt, giving reasons, and shall pay the undisputed part by the due date. The parties shall work together in good faith to resolve the dispute promptly.

All amounts are exclusive of sales tax, value added tax and similar taxes, which the Customer shall pay in addition at the applicable rate.`,
    auto: `The Supplier shall invoice the Customer {#is_invoiced_in_advance}in advance{/is_invoiced_in_advance}{^is_invoiced_in_advance}in arrears{/is_invoiced_in_advance}. The Customer shall pay each invoice within {payment_days} days of receipt.`,
    points: [
      ['When the clock starts', '"Within 30 days of receipt" and "within 30 days of the invoice date" can differ by a week. "End of month following" is longer still.'],
      ['Legal limits on long terms', 'Some laws cap business payment terms. In the European Union, payment terms between businesses generally may not exceed 60 days unless expressly agreed and not grossly unfair to the creditor.'],
      ['Disputed invoices', 'Requiring disputes to be raised quickly, and the undisputed part to be paid, stops a small query from holding up a whole invoice.'],
      ['Taxes and currency', 'State whether prices include tax and which currency applies, especially with international customers.'],
    ],
    faq: [
      ['What does "net 30" mean?', 'Payment is due 30 days after the invoice date, or after receipt if the contract says so. "Net 60" and "net 90" work the same way with longer periods.'],
      ['Can I stop work if a customer does not pay?', 'Only if the contract allows it or the general law does. Stopping work without a contractual right can itself be a breach, so include a right to suspend on notice for overdue invoices.'],
    ],
    templates: ['service-agreement', 'independent-contractor-agreement', 'consulting-agreement', 'statement-of-work'],
  },
  {
    slug: 'late-payment-interest-clause', name: 'Late payment interest clause', group: 'Money',
    what: 'A late payment clause lets the party that is owed money charge interest on overdue amounts, and often suspend work until it is paid.',
    when: 'Include one in any contract where you invoice for goods or services. Customers pay faster when late payment has a visible cost.',
    sample: `If the Customer fails to pay any amount due under this Agreement by the due date, the Supplier may charge interest on the overdue amount at the rate of one and one-half percent (1.5%) per month, or the maximum rate permitted by law if lower, from the due date until the date of actual payment, whether before or after judgment.

In addition, if any undisputed amount remains unpaid more than seven (7) days after the Supplier gives written notice of non-payment, the Supplier may suspend performance of the Services until the amount is paid in full.`,
    auto: `{#charges_interest}
Overdue amounts bear interest at {interest_rate} from the due date until payment.
{/charges_interest}`,
    points: [
      ['A reasonable rate', 'A rate far above commercial rates can be struck down as a penalty or breach usury limits, which vary by US state. Adding "or the maximum rate permitted by law if lower" is a common safeguard.'],
      ['Statutory interest', 'In the UK, businesses can claim statutory interest at 8% above the Bank of England base rate, plus fixed compensation, on late commercial payments where the contract does not provide a substantial remedy of its own.'],
      ['Before or after judgment', 'Saying interest runs "whether before or after judgment" avoids an argument once you go to court.'],
      ['Suspension', 'A right to pause work is often more persuasive than interest. Require written notice first.'],
    ],
    faq: [
      ['What interest rate can I charge on late invoices?', 'Whatever the contract says, within legal limits. 1% to 1.5% per month is common in US commercial contracts, subject to state usury laws. Without a contract term, you may be limited to a statutory rate or none at all.'],
      ['Can I charge interest if the contract does not mention it?', 'Sometimes. UK businesses have a statutory right to interest on late commercial payments. In many other places, you can only claim interest if the contract provides for it or a court awards it.'],
    ],
    templates: ['payment-demand-letter', 'service-agreement', 'promissory-note'],
  },
  {
    slug: 'intellectual-property-clause', name: 'Intellectual property assignment clause', group: 'Work and ownership',
    what: 'An intellectual property clause decides who owns the copyright, designs, inventions and other rights in the work created under a contract, and what each side may do with the other\'s pre-existing material.',
    when: 'Essential whenever a contractor, consultant, agency or developer creates something for a client: code, designs, content, reports or inventions.',
    sample: `The Contractor hereby assigns to the Client all intellectual property rights in the Deliverables, including by way of present assignment of future rights, with effect from their creation or, if later, from payment in full of the fees for the relevant Deliverables. The Contractor shall sign any documents and do anything else reasonably required to confirm or register the Client's ownership.

The Contractor retains ownership of all materials it owned before this Agreement or develops independently of it, and of its general skills and know-how ("Background Materials"). To the extent any Background Materials are incorporated into the Deliverables, the Contractor grants the Client a non-exclusive, perpetual, irrevocable, royalty-free licence to use, copy and modify them as part of the Deliverables.`,
    auto: `{#client_owns_ip}
The Contractor hereby assigns to the Client all intellectual property rights in the Deliverables.
{/client_owns_ip}{^client_owns_ip}
The Contractor retains ownership of the Deliverables and grants the Client a non-exclusive, perpetual licence to use them for its business.
{/client_owns_ip}`,
    points: [
      ['Default ownership surprises people', 'In many countries a contractor, unlike an employee, owns the copyright in what they create unless there is a written assignment. Paying for the work is not enough.'],
      ['"Hereby assigns", not "agrees to assign"', 'US courts have held that "agrees to assign" is only a promise to assign in future, while "hereby assigns" transfers the rights immediately.'],
      ['Background IP', 'Contractors reuse their own code, templates and methods. Keep ownership of those and license them, or the contractor gives away tools they need for every client.'],
      ['Moral rights', 'In some countries authors keep moral rights, such as the right to be named, that cannot be assigned but can be waived where the law allows.'],
    ],
    faq: [
      ['Who owns work created by a contractor?', 'Usually the contractor, unless a written agreement assigns it to the client. Employees are different: work created in the course of employment generally belongs to the employer.'],
      ['Is "work made for hire" the same as an assignment?', 'Not quite. In US copyright law, work made for hire applies automatically to employees, but for contractors only to certain categories of commissioned work with a signed agreement. That is why most contracts also include a backup assignment.'],
    ],
    templates: ['independent-contractor-agreement', 'consulting-agreement', 'statement-of-work'],
  },
  {
    slug: 'warranty-clause', name: 'Warranty clause', group: 'Work and ownership',
    what: 'A warranty is a contractual promise about a fact or about quality, such as that services will be performed with reasonable skill and care, or that software will work as specified for 90 days. The warranty clause also sets the remedy when the promise is broken.',
    when: 'Used in services, software, supply and sale agreements. Buyers want clear promises; sellers want clear limits and a defined remedy.',
    sample: `The Supplier warrants that (a) the Services will be performed with reasonable skill and care and in accordance with good industry practice; (b) the Deliverables will conform in all material respects to their specification for ninety (90) days after delivery; and (c) it has all rights necessary to grant the rights granted under this Agreement.

If the Deliverables do not comply with warranty (b) and the Customer notifies the Supplier within the warranty period, the Supplier shall, as the Customer's sole remedy for that breach, correct or re-perform the non-conforming Deliverables at no additional cost or, if it cannot do so within a reasonable time, refund the fees paid for them.

Except as expressly set out in this Agreement, all warranties, conditions and other terms implied by statute or common law are excluded to the fullest extent permitted by law.`,
    auto: `The Supplier warrants that the Deliverables will conform in all material respects to their specification for {warranty_days} days after delivery.`,
    points: [
      ['Be specific', '"Reasonable skill and care" and "conforms to the specification" can be tested. "Fit for purpose" and "error-free" are far wider promises.'],
      ['Warranty period', 'Thirty to ninety days is common for software and deliverables.'],
      ['Sole remedy', 'Fixing, re-performing or refunding as the only remedy gives both sides certainty, but courts may not enforce it if the remedy fails entirely.'],
      ['Disclaiming implied terms', 'In the US, disclaiming the implied warranty of merchantability must be conspicuous, which is why disclaimers are often in capital letters. Consumer protection laws usually prevent implied terms being excluded in consumer contracts.'],
    ],
    faq: [
      ['What is the difference between a warranty and a representation?', 'A representation is a statement of fact that induces someone to enter the contract; a false one can allow the contract to be unwound. A warranty is a contractual promise; breaching it gives a claim for damages. Many contracts use both words together.'],
      ['Why are warranty disclaimers written in capital letters?', 'Under the US Uniform Commercial Code, a disclaimer of the implied warranty of merchantability must be conspicuous. Capital letters or bold type are the usual way to show that.'],
    ],
    templates: ['service-agreement', 'statement-of-work'],
  },
  {
    slug: 'independent-contractor-clause', name: 'Independent contractor clause', group: 'Work and ownership',
    what: 'This clause records that a person is engaged as an independent business, not as an employee, and that they are responsible for their own taxes, insurance and working arrangements.',
    when: 'Include it in every contractor, freelancer and consulting agreement. It sets expectations, although it does not decide the legal question on its own.',
    sample: `The Contractor is an independent contractor and not an employee, worker, partner or agent of the Client. The Contractor determines the manner and means by which the Services are performed, may provide services to other clients during the term of this Agreement, and supplies its own equipment.

The Contractor is solely responsible for all income tax, social security contributions and other taxes and charges relating to its fees, and shall indemnify the Client against any such liability. Nothing in this Agreement entitles the Contractor to any employee benefits, and the Contractor has no authority to bind the Client.`,
    auto: `The Contractor is an independent contractor{#has_substitution_right} and may appoint a suitably qualified substitute to perform the Services, at its own cost{/has_substitution_right}.`,
    points: [
      ['The label does not decide the question', 'Tax authorities and courts look at how the work is actually done: control, integration, financial risk and whether the person can send a substitute. In the US that means tests such as the IRS common-law test and, in California, the ABC test; in the UK, the IR35 off-payroll rules.'],
      ['Make the contract match reality', 'A contract saying the contractor controls their hours, while the client sets a timetable and supplies a laptop, undermines itself.'],
      ['Tax indemnity', 'If the relationship is reclassified, the client may owe employment taxes. An indemnity from the contractor shifts some of that risk.'],
      ['Substitution', 'A genuine right to send a substitute is one of the strongest indicators of self-employment in some countries.'],
    ],
    faq: [
      ['Does calling someone a contractor make them one?', 'No. The legal status depends on the substance of the relationship. The clause helps show what the parties intended but is not decisive.'],
      ['What happens if a contractor is misclassified?', 'The business may owe back taxes, penalties and employee benefits such as holiday pay or overtime, depending on the country.'],
    ],
    templates: ['independent-contractor-agreement', 'consulting-agreement'],
  },
  {
    slug: 'termination-for-convenience-clause', name: 'Termination for convenience clause', group: 'Ending the contract',
    what: 'A termination for convenience clause lets a party end the contract without giving any reason, usually on a period of written notice.',
    when: 'Common in services, consulting and outsourcing contracts, and in public-sector contracts. Customers want flexibility; suppliers want enough notice to replace the work.',
    sample: `Either party may terminate this Agreement at any time for any reason by giving the other party at least thirty (30) days' written notice.

On termination under this clause, the Customer shall pay the Supplier for all Services performed up to the termination date, together with any expenses properly incurred and any non-cancellable commitments made by the Supplier before it received the notice.`,
    auto: `{#is_mutual}Either party{/is_mutual}{^is_mutual}The Customer{/is_mutual} may terminate this Agreement for any reason by giving at least {notice_days} days' written notice.`,
    points: [
      ['Who gets the right', 'A customer-only right is common in customer-drafted contracts. Suppliers should ask for a mutual right or a longer notice period.'],
      ['Payment for work done', 'Make sure work in progress, expenses and non-cancellable commitments are paid for.'],
      ['Minimum terms', 'If the price assumed a long commitment, add a minimum term or an early termination fee.'],
      ['What survives', 'Confidentiality, payment and liability terms should continue after termination; see the survival clause.'],
    ],
    faq: [
      ['What is the difference between termination for convenience and termination for cause?', 'Termination for convenience needs no reason, only notice. Termination for cause is available only when the other party has breached the contract or become insolvent, and can often take effect immediately.'],
      ['Can a contract with no termination clause be ended early?', 'Generally not unilaterally, unless the other party commits a serious breach. Contracts with no fixed end date may be terminable on reasonable notice, depending on local law.'],
    ],
    templates: ['independent-contractor-agreement', 'consulting-agreement', 'engagement-letter', 'service-agreement'],
  },
  {
    slug: 'termination-for-cause-clause', name: 'Termination for cause clause', group: 'Ending the contract',
    what: 'A termination for cause clause lets a party end the contract when the other party commits a material breach and does not fix it in time, or becomes insolvent.',
    when: 'Every contract with ongoing obligations should have one, so both sides know exactly when a problem is serious enough to walk away.',
    sample: `Either party may terminate this Agreement with immediate effect by giving written notice to the other party if:

(a) the other party commits a material breach of this Agreement that is not capable of remedy, or that is capable of remedy but is not remedied within thirty (30) days after the other party receives written notice identifying the breach and requiring it to be remedied; or

(b) the other party becomes insolvent, makes any arrangement with its creditors, has a receiver, administrator or liquidator appointed over any of its assets, or ceases to carry on business.`,
    auto: `Either party may terminate this Agreement immediately by written notice if the other party commits a material breach that is not remedied within {cure_days} days of written notice{#include_insolvency_termination}, or if the other party becomes insolvent{/include_insolvency_termination}.`,
    points: [
      ['Cure period', 'Fourteen to thirty days is typical. A breach notice should identify the breach and say it must be fixed, or the cure period may never start.'],
      ['What is "material"?', 'Courts decide based on the whole contract. If some breaches should always justify termination, such as a confidentiality breach or non-payment, list them.'],
      ['Insolvency', 'Insolvency laws in some countries, including the US and the UK, restrict terminating supply contracts because the customer has entered an insolvency process. The clause may not be enforceable in every case.'],
      ['Follow the notice clause', 'Terminations that are sent the wrong way or to the wrong address are a common source of disputes.'],
    ],
    faq: [
      ['What counts as a material breach?', 'A breach serious enough to substantially deprive the other party of what it bargained for. Late payment of a single small invoice usually is not; a failure to deliver the core service usually is.'],
      ['What is a cure period?', 'The time the breaching party has, after receiving notice, to fix the breach before the other party can terminate.'],
    ],
    templates: ['service-agreement', 'consulting-agreement', 'independent-contractor-agreement'],
  },
  {
    slug: 'survival-clause', name: 'Survival clause', group: 'Ending the contract',
    what: 'A survival clause lists the obligations that continue after a contract ends, such as confidentiality, payment, indemnities and limits on liability.',
    when: 'Include one in any contract with obligations that should outlive it. Without it, parties may argue about whether a clause ended with the contract.',
    sample: `Termination or expiry of this Agreement shall not affect any rights, remedies, obligations or liabilities of the parties that have accrued up to the date of termination or expiry, including the right to claim damages for any breach that existed at or before that date.

The clauses headed Confidentiality, Intellectual Property, Indemnity, Limitation of Liability, Payment (in respect of amounts accrued before termination), Governing Law and Jurisdiction, and any other provision that expressly or by implication is intended to continue, shall survive termination or expiry of this Agreement.`,
    auto: `The clauses headed Confidentiality, Limitation of Liability and Governing Law{#has_ip_clause}, Intellectual Property{/has_ip_clause} shall survive termination or expiry of this Agreement.`,
    points: [
      ['List the clauses by name', 'Clause numbers change during drafting; headings are safer, or check the numbers at the end.'],
      ['Accrued rights', 'Payment for work already done and claims for past breaches should survive in every case.'],
      ['Time limits', 'If confidentiality should last three years after termination, say so in the confidentiality clause itself.'],
    ],
    faq: [
      ['Do all clauses end when a contract ends?', 'Not necessarily. Courts will often treat clauses such as confidentiality or dispute resolution as intended to survive, but a survival clause removes the doubt.'],
      ['Should the limitation of liability clause survive?', 'Yes. Claims are often made after a contract ends, and the cap should still apply to them.'],
    ],
    templates: ['mutual-nda', 'service-agreement'],
  },
  {
    slug: 'governing-law-clause', name: 'Governing law and jurisdiction clause', group: 'Law and disputes',
    what: 'A governing law clause chooses which country\'s or state\'s law applies to the contract. A jurisdiction clause chooses which courts will hear disputes about it. They are separate choices, usually placed together.',
    when: 'Every contract should have both, and they matter most when the parties are in different states or countries.',
    sample: `This Agreement and any dispute or claim (including non-contractual disputes or claims) arising out of or in connection with it or its subject matter or formation shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of laws principles.

The courts of the State of New York sitting in New York County, and the United States District Court for the Southern District of New York, shall have exclusive jurisdiction to settle any dispute or claim arising out of or in connection with this Agreement.`,
    auto: `This Agreement is governed by the laws of {governing_law}.{#has_jurisdiction} The courts of {jurisdiction} have exclusive jurisdiction over any dispute arising out of it.{/has_jurisdiction}`,
    points: [
      ['Law and courts are different', 'You can choose New York law and London courts, but it is usually cheaper and faster to match the two.'],
      ['Exclusive or non-exclusive', 'Exclusive jurisdiction stops the other party suing elsewhere. Non-exclusive leaves room to sue where the other party\'s assets are.'],
      ['Non-contractual claims', 'Covering claims such as misrepresentation and negligence stops a party avoiding the clause by suing in tort.'],
      ['Mandatory local law', 'Consumers and employees are often protected by the law of where they live or work, whatever the contract says.'],
    ],
    faq: [
      ['What is the difference between governing law and jurisdiction?', 'Governing law is the set of legal rules used to interpret the contract. Jurisdiction is which court decides the dispute. A court in one country can apply another country\'s law, but it is slower and more expensive.'],
      ['What happens if a contract does not choose a governing law?', 'Courts apply conflict-of-laws rules to work it out, typically looking at where the parties are and where the contract is performed. The result can be uncertain and expensive to argue about.'],
    ],
    templates: ['mutual-nda', 'one-way-nda', 'service-agreement', 'independent-contractor-agreement', 'consulting-agreement', 'promissory-note'],
  },
  {
    slug: 'dispute-resolution-clause', name: 'Dispute resolution clause', group: 'Law and disputes',
    what: 'A dispute resolution clause sets out the steps the parties must take when they disagree: usually negotiation between senior people first, then mediation, then arbitration or court.',
    when: 'Useful in long-term commercial relationships, international contracts, and anywhere confidentiality or speed matters more than a public court judgment.',
    sample: `If any dispute arises out of or in connection with this Agreement, either party may give the other written notice of the dispute. Senior representatives of each party with authority to settle the dispute shall meet within fourteen (14) days of the notice and attempt in good faith to resolve it.

If the dispute is not resolved within thirty (30) days of the notice, it shall be referred to and finally resolved by arbitration under the rules of [the named arbitral institution] by a sole arbitrator. The seat of the arbitration shall be [city], and the language of the arbitration shall be English.

Nothing in this clause prevents either party from seeking urgent interim or injunctive relief from any court of competent jurisdiction.`,
    auto: `If the dispute is not resolved within {negotiation_days} days, {#include_arbitration}it shall be finally resolved by arbitration under the {arbitration_rules}, seated in {arbitration_seat}{/include_arbitration}{^include_arbitration}either party may bring proceedings in the courts of {jurisdiction}{/include_arbitration}.`,
    points: [
      ['Deadlines for each step', 'Escalation and mediation steps need time limits, or a party can delay proceedings indefinitely.'],
      ['Arbitration essentials', 'Name the rules, the seat, the number of arbitrators and the language. Missing any of them invites a dispute about the dispute clause.'],
      ['Court or arbitration', 'Arbitration is private and its awards are enforceable in over 170 countries under the New York Convention, but it can be expensive for small claims. Courts are public, can be cheaper and allow appeals.'],
      ['Urgent relief', 'Always keep the right to go to court for an injunction, for example to stop a confidentiality breach.'],
    ],
    faq: [
      ['Should I choose arbitration or court?', 'Arbitration suits international contracts, confidential disputes and technical subject matter. Courts often suit domestic contracts and smaller claims. Consumer and employment arbitration is restricted in many places.'],
      ['What is a tiered dispute resolution clause?', 'One with escalating steps, such as negotiation, then mediation, then arbitration or litigation. Courts in several countries will enforce the earlier steps if they are clearly defined.'],
    ],
    templates: ['service-agreement', 'consulting-agreement'],
  },
  {
    slug: 'notices-clause', name: 'Notices clause', group: 'Boilerplate',
    what: 'A notices clause says how formal notices under the contract, such as notices of breach, renewal or termination, must be sent, to which address, and when they count as received.',
    when: 'Every contract that allows termination, renewal or claims on notice. A termination sent the wrong way can be invalid.',
    sample: `Any notice given under or in connection with this Agreement shall be in writing and shall be delivered by hand, sent by pre-paid first-class post or recorded delivery, or sent by email, to the address or email address set out at the start of this Agreement or such other address as a party notifies to the other in writing.

A notice is deemed received: if delivered by hand, at the time it is left at the address; if sent by post, at 9:00 am on the second business day after posting; and if sent by email, at the time of transmission, or, if that is outside business hours at the recipient's location, at 9:00 am on the next business day.

This clause does not apply to the service of any proceedings or other documents in any legal action.`,
    auto: `Notices must be sent to the addresses above{#has_notice_email} and copied by email to {party_a_email} and {party_b_email}{/has_notice_email}.`,
    points: [
      ['Is email allowed?', 'If the clause does not permit email, an emailed termination may not count. If it does, consider requiring a copy by post for termination notices.'],
      ['Deemed receipt', 'Clear timing rules decide whether a notice period has started, which often matters for renewals and deadlines.'],
      ['Named recipient', 'Addressing notices to a role, such as the General Counsel, avoids them sitting in a general inbox.'],
      ['Keep addresses current', 'Require parties to notify changes of address, and update the contract record when they do.'],
    ],
    faq: [
      ['Is email valid notice under a contract?', 'Only if the notices clause allows it, or if the clause is silent and the general law accepts it. Many older contracts require post or hand delivery only.'],
      ['What if a notice is sent to the wrong address?', 'It may not be valid, so a deadline such as a renewal cut-off could pass. Courts do sometimes accept notices that actually reached the right person, but that is an argument you want to avoid.'],
    ],
    templates: ['mutual-nda', 'service-agreement'],
  },
  {
    slug: 'entire-agreement-clause', name: 'Entire agreement clause', group: 'Boilerplate',
    what: 'An entire agreement clause, also called an integration or merger clause, says that the written contract contains everything the parties agreed, replacing earlier emails, proposals and conversations.',
    when: 'Standard in almost every commercial contract. It stops a party later relying on something said in negotiations that was never written into the contract.',
    sample: `This Agreement constitutes the entire agreement between the parties and supersedes and extinguishes all previous agreements, promises, assurances, warranties, representations and understandings between them, whether written or oral, relating to its subject matter.

Each party acknowledges that in entering into this Agreement it does not rely on, and shall have no remedies in respect of, any statement, representation, assurance or warranty (whether made innocently or negligently) that is not set out in this Agreement. Nothing in this clause limits or excludes any liability for fraud.`,
    auto: `This Agreement supersedes all previous agreements between the parties relating to its subject matter{#has_prior_nda}, except the non-disclosure agreement between the parties dated {prior_nda_date}, which remains in force{/has_prior_nda}.`,
    points: [
      ['Watch out for earlier NDAs', 'An entire agreement clause can wipe out a confidentiality agreement signed before the deal, including its protection for information already shared. Carve it out expressly if you still need it.'],
      ['Non-reliance wording', 'The acknowledgment that neither party relied on outside statements is what protects against misrepresentation claims.'],
      ['Fraud cannot be excluded', 'Courts will not let a party rely on this clause to escape liability for fraud, so say so to keep the rest of the clause safe.'],
      ['Incorporate the schedules', 'Make sure statements of work, order forms and policies you rely on are part of "this Agreement".'],
    ],
    faq: [
      ['What is a merger clause?', 'Another name for an entire agreement clause, used mainly in the United States. "Integration clause" means the same.'],
      ['Can an entire agreement clause cancel an earlier NDA?', 'Yes, if the NDA covers the same subject matter and is not excluded. Many deals preserve the NDA expressly for that reason.'],
    ],
    templates: ['service-agreement', 'consulting-agreement', 'mutual-nda'],
  },
  {
    slug: 'severability-clause', name: 'Severability clause', group: 'Boilerplate',
    what: 'A severability clause says that if one part of the contract is invalid or unenforceable, the rest of the contract still stands, and the invalid part is trimmed or removed.',
    when: 'Standard in commercial and employment contracts, and particularly useful where a clause, such as a restrictive covenant, might be found too wide.',
    sample: `If any provision or part-provision of this Agreement is or becomes invalid, illegal or unenforceable, it shall be deemed modified to the minimum extent necessary to make it valid, legal and enforceable. If such modification is not possible, the relevant provision or part-provision shall be deemed deleted.

Any modification to or deletion of a provision or part-provision under this clause shall not affect the validity and enforceability of the rest of this Agreement.`,
    auto: '',
    points: [
      ['Modify or delete', 'Some courts will cut an over-wide clause down ("blue pencil"), but many will only delete words, not rewrite them. Draft restrictions so that deleting a part still leaves sense.'],
      ['It cannot save everything', 'If the invalid part goes to the heart of the deal, a court may treat the whole contract as unenforceable.'],
      ['Separate restrictions', 'Writing restrictive covenants as separate obligations makes it easier to strike out one without losing all of them.'],
    ],
    faq: [
      ['Will a severability clause save an unenforceable non-compete?', 'Sometimes. Some US states let courts narrow an unreasonable non-compete; others strike it out entirely; English courts will only delete words and will not rewrite the clause.'],
      ['Is a severability clause necessary?', 'Courts often sever invalid terms anyway, but the clause makes the parties\' intention clear and costs nothing to include.'],
    ],
    templates: ['service-agreement', 'independent-contractor-agreement'],
  },
  {
    slug: 'assignment-clause', name: 'Assignment clause', group: 'Boilerplate',
    what: 'An assignment clause says whether a party can transfer its rights under the contract to someone else, for example when it sells its business, and on what conditions.',
    when: 'Every contract. It matters most when either party might be acquired, reorganise into a new company, or want to subcontract the work.',
    sample: `Neither party may assign, transfer, subcontract or deal in any other manner with any of its rights or obligations under this Agreement without the prior written consent of the other party, such consent not to be unreasonably withheld or delayed.

However, either party may assign this Agreement in its entirety, without consent, to an affiliate or to a successor to all or substantially all of its business or assets to which this Agreement relates, by giving written notice to the other party, provided that the assignee agrees in writing to be bound by this Agreement.`,
    auto: `Neither party may assign this Agreement without the other party's prior written consent{#include_successor_exception}, except to a successor to all or substantially all of its business, on written notice{/include_successor_exception}.`,
    points: [
      ['Assignment versus novation', 'Assignment transfers the benefit of a contract. Transferring obligations generally needs a novation, which requires the other party\'s agreement.'],
      ['Change of control', 'A share sale does not usually assign the contract, because the same company remains the party. If a change of ownership should trigger consent or termination, say so separately.'],
      ['Reasonable consent', '"Not to be unreasonably withheld" stops a counterparty using consent as leverage.'],
      ['Subcontracting', 'Decide whether the supplier can subcontract, and whether it stays responsible for its subcontractors.'],
    ],
    faq: [
      ['Can a contract be assigned without consent?', 'Rights can often be assigned without consent unless the contract prohibits it or the contract is personal in nature. Most commercial contracts restrict assignment expressly.'],
      ['What is the difference between assignment and novation?', 'Assignment transfers rights, such as the right to be paid. Novation replaces a party entirely, transferring both rights and obligations, and needs all parties to agree.'],
    ],
    templates: ['service-agreement', 'consulting-agreement'],
  },
  {
    slug: 'amendment-clause', name: 'Amendment clause', group: 'Boilerplate',
    what: 'An amendment or variation clause says how the contract can be changed, usually only by a written document signed by both parties.',
    when: 'Every contract. It prevents arguments that a phone call or a casual email changed the deal.',
    sample: 'No amendment or variation of this Agreement shall be effective unless it is in writing, expressly refers to this Agreement, and is signed by an authorised representative of each party. For this purpose, "writing" does not include email unless the email attaches a document signed in accordance with this clause.',
    auto: '',
    points: [
      ['Is email "writing"?', 'Courts have treated emails, and even typed names in emails, as written and signed. If you do not want an email exchange to amend the contract, say so.'],
      ['No-oral-modification clauses', 'English courts enforce clauses requiring changes to be in writing. US courts are more willing to find that conduct or oral agreement changed the contract despite such a clause.'],
      ['Change control', 'For project work, a simple change request process lets scope and price change without re-signing the whole contract.'],
    ],
    faq: [
      ['Can a contract be changed by email?', 'Often yes, if the emails show both parties agreed, unless the contract requires a signed document and the governing law enforces that requirement.'],
      ['What is the difference between an amendment and an addendum?', 'An amendment changes existing terms. An addendum adds new terms or material. Both should be signed by both parties.'],
    ],
    templates: ['service-agreement', 'statement-of-work'],
  },
  {
    slug: 'waiver-clause', name: 'Waiver clause', group: 'Boilerplate',
    what: 'A no-waiver clause says that if a party does not enforce a right straight away, for example by accepting a late payment without complaint, it has not given that right up.',
    when: 'Standard in commercial contracts, leases and loan documents, where one side routinely tolerates small breaches to keep the relationship working.',
    sample: 'A failure or delay by a party to exercise any right or remedy provided under this Agreement or by law shall not constitute a waiver of that or any other right or remedy, nor shall it prevent or restrict the further exercise of that or any other right or remedy. No single or partial exercise of any right or remedy shall prevent or restrict the further exercise of that or any other right or remedy. A waiver of any right or remedy is only effective if given in writing and shall apply only to the circumstances for which it is given.',
    auto: '',
    points: [
      ['It is not a complete shield', 'A consistent course of conduct can still create an estoppel or amount to a variation. If you are tolerating a breach, say so in writing and reserve your rights.'],
      ['Reserve rights in letters', 'Demand letters and cease and desist letters often end with an express reservation of rights for the same reason.'],
      ['Written waivers only', 'Requiring waivers in writing avoids arguments about what was said in a meeting.'],
    ],
    faq: [
      ['What does "reservation of rights" mean?', 'A statement that you are not giving up any rights by what you are doing, such as accepting a partial payment. It supports the no-waiver clause.'],
      ['Can accepting late payment waive the right to terminate?', 'It can, if it happens repeatedly without objection. A no-waiver clause and a written reservation of rights make that much less likely.'],
    ],
    templates: ['cease-and-desist-letter', 'payment-demand-letter', 'promissory-note'],
  },
  {
    slug: 'electronic-signature-clause', name: 'Counterparts and electronic signature clause', group: 'Boilerplate',
    what: 'A counterparts clause lets each party sign a separate copy of the contract, with all copies together forming one agreement. An electronic signature clause confirms the parties accept e-signatures and signed PDFs.',
    when: 'In any contract that will be signed remotely, which today means most of them.',
    sample: `This Agreement may be executed in any number of counterparts, each of which when executed shall constitute a duplicate original, but all the counterparts together shall constitute one agreement.

Transmission of an executed counterpart of this Agreement by email (including in PDF format) or by means of an electronic signature service shall take effect as delivery of an executed counterpart of this Agreement. Each party agrees that electronic signatures shall be as valid and binding as handwritten signatures.`,
    auto: '',
    points: [
      ['E-signatures are generally valid', 'The US ESIGN Act and state UETA laws, the EU eIDAS Regulation and UK law all recognise electronic signatures for most commercial contracts.'],
      ['Exceptions exist', 'Wills, some real estate documents, some deeds and documents needing witnesses or notarisation may still require a wet-ink signature or a specific procedure.'],
      ['Know who signed', 'An e-signature service with an audit trail makes it easier to prove who signed and when.'],
    ],
    faq: [
      ['Are electronic signatures legally binding?', 'For most commercial contracts, yes, in the US, the UK, the EU and many other countries. Check local rules for wills, property transfers and documents that must be witnessed.'],
      ['Is a typed name in an email a signature?', 'It can be. Courts in several countries have treated a typed name as a signature where it was intended to authenticate the document.'],
    ],
    templates: ['mutual-nda', 'service-agreement', 'promissory-note'],
  },
  {
    slug: 'at-will-employment-clause', name: 'At-will employment clause', group: 'Employment',
    what: 'An at-will clause states that either the employer or the employee can end the employment at any time, with or without cause or notice, as US law generally allows.',
    when: 'Used in US offer letters, employment agreements and handbooks to preserve at-will status and prevent an argument that employment was for a fixed term.',
    sample: `Your employment with the Company is at will. This means that you or the Company may terminate the employment relationship at any time, with or without cause and with or without notice.

Nothing in this letter or in any Company policy, handbook or practice creates a contract of employment for any particular period. The at-will nature of your employment may be changed only by a written agreement expressly stating that it does so, signed by you and the Company's Chief Executive Officer.`,
    auto: `{#is_us_employee}
Your employment with {company_name} is at will: you or the Company may end it at any time, with or without cause or notice.
{/is_us_employee}`,
    points: [
      ['US only, mostly', 'At-will employment is a US concept, and Montana requires good cause for dismissal after a probationary period. Elsewhere, notice periods and unfair dismissal rules apply instead.'],
      ['Do not contradict it', 'Promises of job security in the same letter or the handbook, such as "permanent position" or a guaranteed term, can undermine at-will status.'],
      ['At will is not unlimited', 'Dismissal for discriminatory or retaliatory reasons, or in breach of public policy, is still unlawful.'],
    ],
    faq: [
      ['Does at-will employment apply outside the United States?', 'No. Most other countries require notice, a fair reason or a fair process to dismiss an employee, and the clause has no effect there.'],
      ['Which US state is not at will?', 'Montana. After a probationary period, its Wrongful Discharge from Employment Act requires good cause for dismissal.'],
    ],
    templates: ['offer-letter', 'internship-offer-letter', 'employment-termination-letter'],
  },
];
