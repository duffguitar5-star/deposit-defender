\# PROJECT\_SPEC.md

\# Texas Security Deposit Refund Assistance SaaS



\## 1. PURPOSE# PROJECT\_SPEC.md

\# Texas Security Deposit Refund Assistance SaaS



\## 1. PURPOSE



This project is a Software-as-a-Service (SaaS) application that provides

STRICTLY NON-LEGAL document preparation and informational assistance

to residential renters in Texas seeking the return of a security deposit.



The objective is to help users:

\- Organize facts

\- Understand publicly available, high-level rules

\- Generate professionally formatted, non-legal documents



This service is NOT a law firm, does NOT provide legal advice, and does NOT

represent users in any dispute.



Primary objective: ship a compliant, sellable MVP.

Learning to code is NOT a goal.



---



\## 2. JURISDICTIONAL SCOPE (HARD CONSTRAINT)



SUPPORTED:

\- Texas residential leases only



EXCLUDED:

\- All other U.S. states

\- Federal claims

\- Commercial leases

\- Roommate disputes not involving a landlord



The application MUST block or reject users outside Texas.



---



\## 3. STRICT NON-LEGAL CONSTRAINTS (CRITICAL)



The application MUST NOT:

\- Provide legal advice

\- Apply law to a user’s specific facts

\- Recommend legal strategy

\- Predict outcomes or likelihood of success

\- Threaten legal action

\- Draft pleadings or court filings

\- Suggest negotiation tactics

\- Contact landlords on the user’s behalf



The application MAY:

\- Summarize publicly available Texas rules in neutral language

\- Provide high-level timelines described as informational

\- Organize user-provided facts

\- Populate pre-written, non-demand informational templates



If ambiguity exists, the safest, most conservative interpretation MUST be used.



---



\## 4. DISCLAIMERS (MANDATORY \& PROMINENT)



Disclaimers MUST appear:

\- On the homepage

\- On all intake pages

\- Immediately before payment

\- On generated documents

\- In the footer



Required concepts (exact wording flexible, meaning fixed):

\- “This service is not a law firm”

\- “No legal advice is provided”

\- “This is a document preparation and informational service only”

\- “No outcome is guaranteed”

\- “You may wish to consult a licensed Texas attorney”



Disclaimers MUST be centralized in a single config/constants file.



---



\## 5. USER FLOW (MVP ONLY)



1\. User confirms Texas residency and Texas lease

2\. User completes structured intake:

&nbsp;  - Lease start and end dates

&nbsp;  - Move-out date

&nbsp;  - Security deposit amount

&nbsp;  - Deductions claimed (if any)

&nbsp;  - Dates and methods of communication

3\. System structures data into normalized form

4\. System generates:

&nbsp;  - Informational summary (plain-language, non-legal)

&nbsp;  - Texas-specific informational letter template

&nbsp;  - Optional checklist or timeline reference

5\. User downloads documents as PDF

6\. Optional email delivery to the user only



NO automated landlord contact.



---



\## 6. DOCUMENT GENERATION RULES



Documents MUST:

\- Avoid demands, threats, or ultimatums

\- Avoid legal conclusions

\- Avoid statutory interpretation

\- Avoid “you are entitled to” language



Documents MAY:

\- State factual assertions supplied by the user

\- Reference publicly available Texas rules in neutral phrasing

\- Use cautious language (e.g., “according to publicly available information”)



Tone: professional, neutral, conservative.



---



\## 7. MONETIZATION



\- Flat fee or tiered pricing

\- Payment collected BEFORE document generation

\- No contingency fees

\- No outcome-based guarantees

\- Refund policy independent of success or failure



---



\## 8. TECHNICAL GUIDELINES



\- Favor simplicity over cleverness

\- Explicit code over abstraction

\- Minimal dependencies

\- Clear folder structure

\- Easy future handoff to a professional developer



Claude is authorized to:

\- Create and edit files

\- Refactor conservatively

\- Write documentation



Claude is NOT authorized to:

\- Expand jurisdiction

\- Change legal posture

\- Modify disclaimer intent

\- Add features without instruction



---



\## 9. CHANGE CONTROL (NON-NEGOTIABLE)



Any change affecting:

\- User-facing language

\- Disclaimers

\- Scope of assistance

\- Jurisdiction



MUST be explicitly approved by the project owner.



---



\## 10. MVP SUCCESS CRITERIA



\- Texas users can complete intake

\- Documents generate correctly

\- Language remains conservative and compliant

\- No legal advice is given

\- Codebase is stable and understandable





This project is a Software-as-a-Service (SaaS) application that provides

STRICTLY NON-LEGAL document preparation and informational assistance

to residential renters in Texas seeking the return of a security deposit.



The objective is to help users:

\- Organize facts

\- Understand publicly available, high-level rules

\- Generate professionally formatted, non-legal documents



This service is NOT a law firm, does NOT provide legal advice, and does NOT

represent users in any dispute.



Primary objective: ship a compliant, sellable MVP.

Learning to code is NOT a goal.



---



\## 2. JURISDICTIONAL SCOPE (HARD CONSTRAINT)



SUPPORTED:

\- Texas residential leases only



EXCLUDED:

\- All other U.S. states

\- Federal claims

\- Commercial leases

\- Roommate disputes not involving a landlord



The application MUST block or reject users outside Texas.



---



\## 3. STRICT NON-LEGAL CONSTRAINTS (CRITICAL)



The application MUST NOT:

\- Provide legal advice

\- Apply law to a user’s specific facts

\- Recommend legal strategy

\- Predict outcomes or likelihood of success

\- Threaten legal action

\- Draft pleadings or court filings

\- Suggest negotiation tactics

\- Contact landlords on the user’s behalf



The application MAY:

\- Summarize publicly available Texas rules in neutral language

\- Provide high-level timelines described as informational

\- Organize user-provided facts

\- Populate pre-written, non-demand informational templates



If ambiguity exists, the safest, most conservative interpretation MUST be used.



---



\## 4. DISCLAIMERS (MANDATORY \& PROMINENT)



Disclaimers MUST appear:

\- On the homepage

\- On all intake pages

\- Immediately before payment

\- On generated documents

\- In the footer



Required concepts (exact wording flexible, meaning fixed):

\- “This service is not a law firm”

\- “No legal advice is provided”

\- “This is a document preparation and informational service only”

\- “No outcome is guaranteed”

\- “You may wish to consult a licensed Texas attorney”



Disclaimers MUST be centralized in a single config/constants file.



---



\## 5. USER FLOW (MVP ONLY)



1\. User confirms Texas residency and Texas lease

2\. User completes structured intake:

&nbsp;  - Lease start and end dates

&nbsp;  - Move-out date

&nbsp;  - Security deposit amount

&nbsp;  - Deductions claimed (if any)

&nbsp;  - Dates and methods of communication

3\. System structures data into normalized form

4\. System generates:

&nbsp;  - Informational summary (plain-language, non-legal)

&nbsp;  - Texas-specific informational letter template

&nbsp;  - Optional checklist or timeline reference

5\. User downloads documents as PDF

6\. Optional email delivery to the user only



NO automated landlord contact.



---



\## 6. DOCUMENT GENERATION RULES



Documents MUST:

\- Avoid demands, threats, or ultimatums

\- Avoid legal conclusions

\- Avoid statutory interpretation

\- Avoid “you are entitled to” language



Documents MAY:

\- State factual assertions supplied by the user

\- Reference publicly available Texas rules in neutral phrasing

\- Use cautious language (e.g., “according to publicly available information”)



Tone: professional, neutral, conservative.



---



\## 7. MONETIZATION



\- Flat fee or tiered pricing

\- Payment collected BEFORE document generation

\- No contingency fees

\- No outcome-based guarantees

\- Refund policy independent of success or failure



---



\## 8. TECHNICAL GUIDELINES



\- Favor simplicity over cleverness

\- Explicit code over abstraction

\- Minimal dependencies

\- Clear folder structure

\- Easy future handoff to a professional developer



Claude is authorized to:

\- Create and edit files

\- Refactor conservatively

\- Write documentation



Claude is NOT authorized to:

\- Expand jurisdiction

\- Change legal posture

\- Modify disclaimer intent

\- Add features without instruction



---



\## 9. CHANGE CONTROL (NON-NEGOTIABLE)



Any change affecting:

\- User-facing language

\- Disclaimers

\- Scope of assistance

\- Jurisdiction



MUST be explicitly approved by the project owner.



---



\## 10. MVP SUCCESS CRITERIA



\- Texas users can complete intake

\- Documents generate correctly

\- Language remains conservative and compliant

\- No legal advice is given

\- Codebase is stable and understandable



