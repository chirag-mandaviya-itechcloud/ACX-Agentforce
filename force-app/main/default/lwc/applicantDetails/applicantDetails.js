import { api, LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createApplicantRecord from '@salesforce/apex/BookingController.createApplicantRecord';
import getApplicantsForBooking from '@salesforce/apex/BookingController.getApplicantsForBooking';
import moveFilesToApplicant from '@salesforce/apex/BookingController.moveFilesToApplicant';
import getEmailFromOpportunity from '@salesforce/apex/BookingController.getEmailFromOpportunity';
import thankYouPhoto from '@salesforce/resourceUrl/ThankYouPhoto';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import DOCUMENT_TYPE from '@salesforce/schema/ContentVersion.Document_Type__c';
import APPLICANT_OBJECT from '@salesforce/schema/Applicant__c';


export default class ApplicantDetails extends LightningElement {
    @api recordId;
    @track isWelcomeScreen = false;
    @track showSpinner = false;
    @track isThanks = false;
    @track isPath = false;
    @track isPreview = false;
    @track isErrorMsg = false;
    @track isSubmit = true;
    @track applicants = [];
    @track activeSections = [];
    @track isSaving = false;
    @track statusList = ['Submit Details', 'Verify Details'];

    applicantCounter = 0;
    recordTypeId;
    applicantFiles = {};
    applicantRecordTypeId;
    oppEmail;
    @track thankYouImage;

    @track frontAadharIds = [];
    backAadharIds = [];
    panIds = [];
    otherDocIds = [];
    selectedDocType = '';
    verifyEmail;

    // Added by Chirag
    @track dataFromChatbot = {};


    @track addressData = {
        // Correspondence Address
        corrAddress: '',
        corrCity: '',
        corrState: '',
        corrPincode: '',
        corrCountry: 'IN',
        sameAsPermanent: false,
        // Permanent Address
        permAddress: '',
        permCity: '',
        permState: '',
        permPincode: '',
        permCountry: 'IN'
    };

    // get vfPageUrl() {
    //         return `../apex/ApplicantDetailsForm?id=${this.recordId}`;
    //     }

    get renderedStages() {
        return this.statusList.map(stage => {
            const isCurrent = stage === this.currentStage;
            const isCompleted = this.completedStages.includes(stage);

            return {
                name: stage,
                className: `slds-path__item ${isCurrent ? 'slds-is-current slds-is-active' :
                    isCompleted ? 'slds-is-complete' :
                        'slds-is-incomplete'
                    }`,
                selected: isCurrent ? 'true' : 'false',
                tabIndex: isCurrent ? '0' : '-1'
            };
        });
    }

    handleVerifyEmail() {
        console.log('clicked');
        this.currentStage = 'Submit Details';

        if (this.verifyEmail === this.oppEmail) {
            this.isErrorMsg = false;
            this.isSubmit = true;
            this.isWelcomeScreen = false;
            this.isPath = true;
            this.isPreview = false;
        }
        else {
            this.isErrorMsg = true;
        }
        this.handleMarkComplete();
    }

    handleChange(event) {
        if (event.target.name === 'email') {
            this.verifyEmail = event.target.value.replace(/\s+/g, '').trim();
        }
    }

    validateEmail(event) {
        const emailField = event.target;
        const email = this.verifyEmail;

        // your own regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            emailField.setCustomValidity(''); // ❌ no message shown
            emailField.reportValidity();       // keeps UI clean
        } else {
            emailField.setCustomValidity('');
            emailField.reportValidity();
        }
    }

    handleMarkComplete() {
        if (this.currentStage === 'Submit Details') {
            this.completedStages = [...this.currentStage];
        }

        const currentIndex = this.statusList.indexOf(this.currentStage);
        if (currentIndex < this.statusList.length - 1) {
            this.currentStage = this.statusList[currentIndex];
        }
    }



    @wire(getObjectInfo, { objectApiName: APPLICANT_OBJECT })
    results({ error, data }) {
        if (data) {
            this.applicantRecordTypeId = data.defaultRecordTypeId;
            console.log(this.applicantRecordTypeId);

        } else if (error) {
            console.error('Error loading Applicant Record type Id', error);
        }
    }

    @wire(getPicklistValues, {
        recordTypeId: '$cvRecordTypeId',
        fieldApiName: DOCUMENT_TYPE
    })
    wiredDocumentTypePicklistValues({ error, data }) {
        if (data) {
            this.optionsDocType = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));
        } else if (error) {
            console.error('Error loading Document Type picklist values', error);
        }
    }

    async handleFrontAdharUpload(event) {
        this.showSpinner = true;
        const applicantId = event.target.dataset.id;
        const uploadedFiles = event.detail.files;
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        const uploadedFile = uploadedFiles[0];
        const documentId = uploadedFile.documentId;

        if (!this.applicantFiles[applicantId]) {
            this.applicantFiles[applicantId] = { frontAadhar: [], backAadhar: [], pan: [], other: [] };
        }

        this.applicantFiles[applicantId].frontAadhar.push(documentId);

        try {

            // 3️⃣ Convert file to Base64
            //const base64Data = await getFileBase64({ contentDocumentId: documentId });

            // 4️⃣ Extract OCR text
            // const extracted = await extractTextUsingOCR({
            //     base64File: base64Data,
            //     fileName: uploadedFile.name,
            //     bookingId: this.recordId
            // });

            const parsedResult = JSON.parse(extracted);

            // 5️⃣ Store OCR text inside applicant object
            if (!this.ocrData) this.ocrData = {};
            this.ocrData[applicantId] = parsedResult;

            console.log('OCR Parsed Result:', parsedResult);

            // 6️⃣ Update applicant fields from OCR
            const appIndex = this.applicants.findIndex(app => app.id === applicantId);

            if (appIndex !== -1) {
                this.applicants[appIndex].firstName = parsedResult.FirstName || '';
                this.applicants[appIndex].middleName = parsedResult.MiddleName || '';
                this.applicants[appIndex].lastName = parsedResult.LastName || '';
                if (parsedResult.DateOfBirth) {
                    const [day, month, year] = parsedResult.DateOfBirth.split('/');
                    this.applicants[appIndex].dateOfBirth =
                        `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }

                this.applicants[appIndex].aadhar = parsedResult.AadhaarNumber;
            }

            console.log('Updated Applicant:', this.applicants[appIndex]);

        } catch (error) {
            this.showSpinner = false;
            console.error('OCR / File Rename Error:', error);
            // this.showToast('Error', 'Something went wrong during OCR', 'error');
        } finally {
            this.showSpinner = false;
        }

    }

    handleBackAdharUpload(event) {
        const applicantId = event.target.dataset.id;
        const uploadedFiles = event.detail.files;
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        const uploadedFile = uploadedFiles[0];
        const documentId = uploadedFile.documentId;

        if (!this.applicantFiles[applicantId]) {
            this.applicantFiles[applicantId] = { frontAadhar: [], backAadhar: [], pan: [], other: [] };
        }

        this.applicantFiles[applicantId].backAadhar.push(documentId);
    }

    async handlePanUpload(event) {
        this.showSpinner = true;
        const applicantId = event.target.dataset.id;
        const uploadedFiles = event.detail.files;
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        const uploadedFile = uploadedFiles[0];
        const documentId = uploadedFile.documentId;

        if (!this.applicantFiles[applicantId]) {
            this.applicantFiles[applicantId] = { frontAadhar: [], backAadhar: [], pan: [], other: [] };
        }

        this.applicantFiles[applicantId].pan.push(documentId);
        try {



            const parsedResult = JSON.parse(extracted);
            console.log('PAN OCR Parsed Result:', parsedResult);

            // Store OCR result per applicant
            if (!this.ocrData) this.ocrData = {};
            this.ocrData[applicantId] = parsedResult;

            // Update the correct applicant record
            const appIndex = this.applicants.findIndex(app => app.id === applicantId);

            if (appIndex !== -1) {

                // PAN number
                this.applicants[appIndex].pan = parsedResult.panNumber || '';

            }

            console.log('Updated Applicant PAN Record:', this.applicants[appIndex]);

        } catch (error) {
            console.error('PAN OCR Error:', error);
            this.showSpinner = false;
            // this.showToast('Error', 'Failed to extract PAN card details', 'error');
        } finally {
            this.showSpinner = false;
        }
    }

    handleUploadDocument(event) {
        const applicantId = event.target.dataset.id;
        const uploadedFiles = event.detail.files;
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        const uploadedFile = uploadedFiles[0];
        const documentId = uploadedFile.documentId;

        if (!this.applicantFiles[applicantId]) {
            this.applicantFiles[applicantId] = { frontAadhar: [], backAadhar: [], pan: [], other: [] };
        }

        this.applicantFiles[applicantId].other.push(documentId);
    }


    connectedCallback() {
        this.thankYouImage = thankYouPhoto;
        const urlParams = new URLSearchParams(window.location.search);
        const bookingId = urlParams.get('bookingId');
        // console.log('Booking ID:', bookingId);
        this.recordId = bookingId;

        // this.getEmail(bookingId);

        if (this.recordId) {
            this.fetchExistingApplicants();
        } else {
            this.addApplicant(true);
        }

        // Added by Chirag
        this.handleMessage = this.handleMessage.bind(this);
        window.addEventListener('message', this.handleMessage);
    }

    disconnectedCallback() {
        window.removeEventListener('message', this.handleMessage);
    }

    // Added by Chirag
    handleMessage(event) {
        try {
            if (!event.data || event.data.source !== 'CHATBOT_LWC' || event.data.type !== 'APPLICANT_DATA' || event.data.validData !== 'true') {
                return;
            }

            if (event.data.validData === 'true') {
                // console.log('ApplicantDetails: Message received Data', JSON.stringify(event.data.data));
                // console.log('ApplicantDetails: Message received type', JSON.stringify(event.data.type));
                // console.log('ApplicantDetails: Message received source', JSON.stringify(event.data.source));
                if (event.data.data) {
                    // console.log('Data from chatbot:', JSON.parse(JSON.stringify(event.data.data)));
                    this.dataFromChatbot = JSON.parse(JSON.stringify(event.data.data));
                    // console.log("Data from chatbot ===> ", this.dataFromChatbot);
                    this.updateFormValues();
                }
            }
        } catch (error) {
            console.error('ApplicantDetails: Error processing message', error);
        }
    }

    // Added by Chirag
    updateFormValues() {
        if (!Array.isArray(this.dataFromChatbot) || !this.dataFromChatbot.length) {
            return;
        }

        this.dataFromChatbot.forEach((payload, index) => {
            if (!this.applicants[index]) {
                this.handleAddApplicant();
            }

            const applicant = this.applicants[index];
            // console.log("Applicant Details: ", JSON.parse(JSON.stringify(applicant)));

            const flattenedData = {
                ...(payload.generalDetails || {}),
                ...(payload.contactDetails || {}),
                ...(payload.professionalDetails || {}),
                ...(payload.residentStatus || {}),
                ...(payload.addressForCorrespondence || {}),
                ...(payload.permanentAddress || {})
            };

            // console.log('Flattened Data from Chatbot:', JSON.stringify(flattenedData));

            const addressFields = ["corrAddress", "corrCity", "corrState", "corrPincode", "corrCountry", "sameAsPermanent", "permAddress", "permCity", "permState", "permPincode", "permCountry"];

            Object.keys(flattenedData).forEach(key => {
                if (addressFields.includes(key)) {
                    if (key.toLowerCase().includes('country')) {
                        this.addressData[key] = this.countryOptions.find(option => option.label === flattenedData[key])?.value || '';
                    } else {
                        this.addressData[key] = flattenedData[key];
                    }
                } else if (key.toLowerCase().includes('country')) {
                    applicant['country'] = this.countryOptions.find(option => option.label === flattenedData[key])?.value || '';
                } else {
                    applicant[key] = flattenedData[key];
                }
            });
        })

        this.applicants = [...this.applicants];
        this.addressData = { ...this.addressData };

        // console.log("Updated applicants : ", JSON.parse(JSON.stringify(this.applicants)));
    }

    getEmail(bookingId) {
        getEmailFromOpportunity({
            bookingId: bookingId
        }).then(result => {
            console.log('Email Id ->', result[0].Opportunity__r.Email__c);
            this.oppEmail = result[0].Opportunity__r.Email__c;
        }).catch(error => {
            console.error('Error fetching email from Opportunity:', error);
        });
    }

    fetchExistingApplicants() {
        // Make imperative Apex call
        getApplicantsForBooking({ bookingId: this.recordId })
            .then(result => {

                // Log each applicant in detail
                if (result && result.length > 0) {
                    result.forEach((app, index) => {

                    });
                }

                if (result && result.length > 0) {
                    const fetchedApplicants = [];
                    let primaryApplicantData = null;
                    let coApplicantCount = 1;

                    for (const app of result) {
                        const isPrimary = app.Is_Primary_Applicant__c;

                        const nameParts = this.splitName(app.Applicant__r.Name__c);

                        const newApplicant = {
                            id: app.Applicant__r.Id,
                            label: isPrimary ? 'Primary Applicant' : `Co-Applicant ${coApplicantCount++}`,
                            isPrimary: isPrimary,
                            entityStatus: app.Applicant__r.Entity_Status__c || 'None',
                            title: app.Applicant__r.Title__c || 'None',
                            firstName: nameParts.firstName,
                            middleName: nameParts.middleName,
                            lastName: nameParts.lastName,
                            relationName: app.Applicant__r.Relation_Name__c || '',
                            relationType: app.Applicant__r.Relationship_to_Primary_Applicant__c || 'None',
                            gender: app.Applicant__r.Gender__c || 'None',
                            maritalStatus: app.Applicant__r.Marital_Status__c || 'None',
                            dateOfBirth: app.Applicant__r.Date_of_Birth__c ?
                                new Date(app.Applicant__r.Date_of_Birth__c).toISOString().substring(0, 10) : '',
                            spouseName: app.Applicant__r.Spouse_Name__c || '',
                            spouseDob: app.Applicant__r.Spouse_DOB__c ?
                                new Date(app.Applicant__r.Spouse_DOB__c).toISOString().substring(0, 10) : '',
                            anniversaryDate: app.Applicant__r.Anniversary_Date__c ?
                                new Date(app.Applicant__r.Anniversary_Date__c).toISOString().substring(0, 10) : '',
                            aadhar: app.Applicant__r.Aadhaar_No__c || '',
                            pan: app.Applicant__r.PAN_No__c || '',
                            mobileCountryCode: app.Applicant__r.Mobile_Country_Code__c || '+91',
                            mobileNumber: app.Applicant__r.Mobile_No__c || '',
                            email: app.Applicant__r.Email_ID__c || '',
                            designation: app.Applicant__r.Designation__c || '',
                            organizationName: app.Applicant__r.Name_of_Company__c || '',
                            organizationType: app.Applicant__r.Organization_Type__c || 'None',
                            organizationAddress: app.Applicant__r.Organization_Address__Street__s || '',
                            city: app.Applicant__r.Organization_Address__City__s || '',
                            state: app.Applicant__r.Organization_Address__StateCode__s || '',
                            pincode: app.Applicant__r.Organization_Address__PostalCode__s || '',
                            country: app.Applicant__r.Organization_Address__CountryCode__s || 'IN',
                            workExperience: app.Applicant__r.Work_Experience__c || 'None',
                            industrySector: app.Applicant__r.Industry__c || 'None',
                            annualIncome: app.Applicant__r.Annual_Income__c || 'None',
                            currentResidentStatus: app.Applicant__r.Current_Resident_Status__c || 'None',
                            currentResidentType: app.Applicant__r.Current_Resident_Type__c || 'None',
                            residentStatus: app.Applicant__r.Resident_status__c || 'None',
                            countryOfResidence: app.Applicant__r.Country_of_Residence__c || '',
                            sameAsPermanent: app.Applicant__r.Same_As_Permanent_Address__c
                        };

                        fetchedApplicants.push(newApplicant);

                        if (!primaryApplicantData) {
                            primaryApplicantData = app.Applicant__r;
                        }
                    }

                    this.applicants = fetchedApplicants;
                    this.applicantCounter = fetchedApplicants.length;
                    this.activeSections = [this.applicants[0].id];


                    if (primaryApplicantData) {
                        this.addressData = {
                            corrAddress: primaryApplicantData.Current_Address__Street__s || '',
                            corrCity: primaryApplicantData.Current_Address__City__s || '',
                            corrState: primaryApplicantData.Current_Address__StateCode__s || '',
                            corrPincode: primaryApplicantData.Current_Address__PostalCode__s || '',
                            corrCountry: primaryApplicantData.Current_Address__CountryCode__s || 'IN',
                            sameAsPermanent: false,
                            permAddress: primaryApplicantData.Permanent_Address__Street__s || '',
                            permCity: primaryApplicantData.Permanent_Address__City__s || '',
                            permState: primaryApplicantData.Permanent_Address__StateCode__s || '',
                            permPincode: primaryApplicantData.Permanent_Address__PostalCode__s || '',
                            permCountry: primaryApplicantData.Permanent_Address__CountryCode__s || 'IN'
                        };

                        // console.log('\n=== ADDRESS DATA ===');
                        // console.log('Address JSON:', JSON.stringify(this.addressData, null, 2));
                    }

                } else {
                    this.addApplicant(true);
                }
            })
            .catch(error => {
                console.error('Error fetching existing applicants:', error);
                console.error('Error details:', JSON.stringify(error));
                this.showToast('Error', 'Could not load existing applicant data.', 'error');
                this.addApplicant(true);
            });
    }

    splitName(fullName) {
        if (!fullName) {
            return { firstName: '', middleName: '', lastName: '' };
        }

        const parts = fullName.trim().split(/\s+/);

        let firstName = '';
        let middleName = '';
        let lastName = '';

        if (parts.length === 1) {
            firstName = parts[0];
        } else if (parts.length === 2) {
            firstName = parts[0];
            lastName = parts[1];
        } else if (parts.length >= 3) {
            firstName = parts[0];
            lastName = parts[parts.length - 1];
            middleName = parts.slice(1, parts.length - 1).join(' ');
        }

        return { firstName, middleName, lastName };
    }


    addApplicant(isPrimary = false) {
        this.applicantCounter++;
        const applicantId = `applicant-${this.applicantCounter}`;

        const newApplicant = {
            id: applicantId,
            label: isPrimary ? 'Primary Applicant' : `Co-Applicant ${this.applicantCounter - 1}`,
            isPrimary: isPrimary,
            entityStatus: 'None',
            title: 'None',
            firstName: '',
            middleName: '',
            lastName: '',
            relationName: '',
            relationType: 'None',
            gender: 'None',
            maritalStatus: 'None',
            dateOfBirth: '',
            spouseName: '',
            spouseDob: '',
            anniversaryDate: '',
            aadhar: '',
            pan: '',
            // Contact Details
            mobileCountryCode: '+91',
            mobileNumber: '',
            email: '',

            // Professional Details
            designation: '',
            organizationName: '',
            organizationType: '',
            organizationAddress: '',
            city: '',
            state: '',
            pincode: '',
            country: 'IN',
            workExperience: 'None',
            industrySector: '',
            annualIncome: '',

            // Current Resident Details
            currentResidentStatus: 'None',
            currentResidentType: 'None',
            residentStatus: '',
            countryOfResidence: ''
        };

        this.applicants = [...this.applicants, newApplicant];

        // Open only the newly added applicant section
        this.activeSections = [applicantId];
    }

    handleAddApplicant() {
        this.addApplicant(false);
        this.showToast('Success', 'Co-Applicant added successfully', 'success');
    }

    handleRemoveApplicant(event) {
        const applicantId = event.currentTarget.dataset.id;
        this.applicants = this.applicants.filter(app => app.id !== applicantId);
        this.showToast('Success', 'Co-Applicant removed successfully', 'success');

        // Update active sections
        this.activeSections = this.activeSections.filter(section => section !== applicantId);

        // Open first section if no sections are open
        if (this.activeSections.length === 0 && this.applicants.length > 0) {
            this.activeSections = [this.applicants[0].id];
        }
    }

    handleApplicantChange(event) {
        const applicantId = event.currentTarget.dataset.id;
        const field = event.currentTarget.dataset.field;
        let value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;

        // Convert PAN to uppercase
        if (field === 'pan') {
            value = value.toUpperCase();
        }

        this.applicants = this.applicants.map(app => {
            if (app.id === applicantId) {
                const updatedApp = { ...app, [field]: value };

                // 🔥 Auto-create FULL NAME when first/middle/last changes
                updatedApp.fullName = [
                    updatedApp.firstName,
                    updatedApp.middleName,
                    updatedApp.lastName
                ]
                    .filter(Boolean)      // removes empty values
                    .join(' ');

                return updatedApp;
            }
            return app;
        });

        console.log('Updated Applicants:', JSON.parse(JSON.stringify(this.applicants)));
    }


    get entityOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Individual', value: 'Individual' },
            { label: 'H.U.F', value: 'H.U.F' },
            { label: 'Society', value: 'Society' },
            { label: 'Trust', value: 'Trust' },
            { label: 'Company', value: 'Company' }
        ];
    }

    get stateOptions() {
        return [
            { label: 'Andaman and Nicobar Islands', value: 'AN' },
            { label: 'Andhra Pradesh', value: 'AP' },
            { label: 'Arunachal Pradesh', value: 'AR' },
            { label: 'Assam', value: 'AS' },
            { label: 'Bihar', value: 'BR' },
            { label: 'Chandigarh', value: 'CH' },
            { label: 'Chhattisgarh', value: 'CT' },
            { label: 'Dadra and Nagar Haveli and Daman and Diu', value: 'DH' },
            { label: 'Delhi', value: 'DL' },
            { label: 'Goa', value: 'GA' },
            { label: 'Gujarat', value: 'GJ' },
            { label: 'Haryana', value: 'HR' },
            { label: 'Himachal Pradesh', value: 'HP' },
            { label: 'Jammu and Kashmir', value: 'JK' },
            { label: 'Jharkhand', value: 'JH' },
            { label: 'Karnataka', value: 'KA' },
            { label: 'Kerala', value: 'KL' },
            { label: 'Ladakh', value: 'LA' },
            { label: 'Lakshadweep', value: 'LD' },
            { label: 'Madhya Pradesh', value: 'MP' },
            { label: 'Maharashtra', value: 'MH' },
            { label: 'Manipur', value: 'MN' },
            { label: 'Meghalaya', value: 'ML' },
            { label: 'Mizoram', value: 'MZ' },
            { label: 'Nagaland', value: 'NL' },
            { label: 'Odisha', value: 'OR' },
            { label: 'Puducherry', value: 'PY' },
            { label: 'Punjab', value: 'PB' },
            { label: 'Rajasthan', value: 'RJ' },
            { label: 'Sikkim', value: 'SK' },
            { label: 'Tamil Nadu', value: 'TN' },
            { label: 'Telangana', value: 'TG' },
            { label: 'Tripura', value: 'TR' },
            { label: 'Uttar Pradesh', value: 'UP' },
            { label: 'Uttarakhand', value: 'UT' },
            { label: 'West Bengal', value: 'WB' }
        ];
    }


    get countryOptions() {
        return [
            { label: 'India', value: 'IN' }
        ];
    }

    get titleOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Mr.', value: 'Mr.' },
            { label: 'Mrs.', value: 'Mrs.' },
            { label: 'Ms.', value: 'Ms.' },
            { label: 'Dr.', value: 'Dr.' },
            { label: 'M/S', value: 'M/S' }
        ];
    }

    get relationOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Son of', value: 'Son of' },
            { label: 'Daughter of', value: 'Daughter of' },
            { label: 'Wife of', value: 'Wife of' }
        ];
    }

    get genderOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Male', value: 'Male' },
            { label: 'Female', value: 'Female' }
        ];
    }

    get maritalOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Single', value: 'Single' },
            { label: 'Married', value: 'Married' }
        ];
    }

    get workExpOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: '0-5 years', value: '0-5 years' },
            { label: '6-10 years', value: '6-10 years' },
            { label: '11-20 years', value: '11-20 years' },
            { label: 'More than 20 years', value: 'More than 20 years' }
        ];
    }

    get incomeOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: '5-9 Lakhs', value: '5-9 Lakhs' },
            { label: '10-14 Lakhs', value: '10-14 Lakhs' },
            { label: '15-20 Lakhs', value: '15-20 Lakhs' },
            { label: '21-25 Lakhs', value: '21-25 Lakhs' },
            { label: 'More than 25 Lakhs', value: 'More than 25 Lakhs' }
        ];
    }

    get industrySectorOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'IT (Information Technology)', value: 'IT' },
            { label: 'Manufacturing', value: 'Manufacturing' },
            { label: 'Financial Services', value: 'Financial Services' },
            { label: 'Retail Services', value: 'Retail Services' },
            { label: 'Travel/Transport', value: 'Travel/Transport' },
            { label: 'TES/BPO/KPO', value: 'TES/BPO/KPO' },
            { label: 'Medical/Pharmaceutical', value: 'Medical/Pharmaceutical' },
            { label: 'Hospitality', value: 'Hospitality' },
            { label: 'Media & Entertainment', value: 'Media & Entertainment' },
            { label: 'Telecom', value: 'Telecom' },
            { label: 'Others', value: 'Others' }
        ];
    }

    get organizationTypeOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Pvt. Ltd.', value: 'Pvt. Ltd.' },
            { label: 'Public Ltd.', value: 'Public Ltd.' },
            { label: 'Govt. Services', value: 'Govt. Services' },
            { label: 'Self-employed / business', value: 'Self-employed' },
            { label: 'Others', value: 'Others' }
        ];
    }

    get residentStatusOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Resident Indian', value: 'Resident Indian' },
            { label: 'NRI', value: 'NRI' },
            { label: 'POI/OCI', value: 'POI/OCI' }
        ];
    }

    get currentResidentStatusOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Owned', value: 'Owned' },
            { label: 'Rented', value: 'Rented' },
            { label: 'Parental', value: 'Parental' },
            { label: 'Company lease', value: 'Company lease' }
        ];
    }

    get currentResidentTypeOptions() {
        return [
            { label: '--None--', value: 'None' },
            { label: 'Apartment', value: 'Apartment' },
            { label: 'Individual House', value: 'Individual House' },
            { label: 'Villa', value: 'Villa' },
            { label: 'Duplex', value: 'Duplex' }
        ];
    }

    get isStep1() {
        return this.currentStep === '1';
    }

    get isStep2() {
        return this.currentStep === '2';
    }

    get isFirstStep() {
        return this.currentStep === '1';
    }

    get showNRIFields() {
        // Use the current applicant displayed in section
        const openSection = this.activeSections[0];
        const applicant = this.applicants.find(app => app.id === openSection);

        if (!applicant) return false;

        return applicant.residentStatus !== 'Resident Indian';
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        const applicantId = event.target.dataset.id;
        const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;

        // If belongs to applicant block
        if (applicantId) {
            this.applicants = this.applicants.map(app =>
                app.id === applicantId ? { ...app, [field]: value } : app
            );
        }
        else {
            // Update address data reactively
            this.addressData = { ...this.addressData, [field]: value };

            // Copy correspondence → permanent
            if (field === "sameAsPermanent" && value) {
                this.addressData = {
                    ...this.addressData,
                    permAddress: this.addressData.corrAddress,
                    permCity: this.addressData.corrCity,
                    permState: this.addressData.corrState,
                    permPincode: this.addressData.corrPincode,
                    permCountry: this.addressData.corrCountry
                };
            }

            // If unchecked → clear permanent address
            if (field === "sameAsPermanent" && !value) {
                this.addressData = {
                    ...this.addressData,
                    permAddress: "",
                    permCity: "",
                    permState: "",
                    permPincode: "",
                    permCountry: ""
                };
            }
        }
    }



    handleNext() {
        if (this.validateCurrentStep()) {
            this.currentStep = String(parseInt(this.currentStep) + 1);
            window.scrollTo(0, 0);
        }
    }

    handlePrevious() {
        this.currentStep = String(parseInt(this.currentStep) - 1);
        window.scrollTo(0, 0);
    }

    validateCurrentStep() {
        if (this.currentStep === '1') {


            return true;
        } else {

        }
    }


    validateApplicant(applicant) {
        const errors = [];

        if (!applicant.firstName || !applicant.firstName.trim()) {
            errors.push('First Name is required');
        }
        if (!applicant.lastName || !applicant.lastName.trim()) {
            errors.push('Last Name is required');
        }


        return errors;
    }

    async handleSave() {
        if (this.isSaving) return false;

        // Validate all applicants
        let hasErrors = false;
        for (let applicant of this.applicants) {
            const errors = this.validateApplicant(applicant);
            if (errors.length > 0) {
                this.showToast('Validation', errors.join(', '), 'error');
                this.activeSections = [applicant.id];
                hasErrors = true;
                break;
            }
        }

        if (hasErrors) return false;

        this.isSaving = true;

        try {
            // Process each applicant sequentially
            const savedApplicantIds = [];

            for (let applicant of this.applicants) {
                // Create a plain JavaScript object (not tracked/proxied)
                const plainApplicant = JSON.parse(JSON.stringify(applicant));
                const plainAddress = JSON.parse(JSON.stringify(this.addressData));

                // Merge address data with applicant data
                const applicantWithAddress = {
                    id: plainApplicant.id,
                    label: plainApplicant.label,
                    isPrimary: plainApplicant.isPrimary,
                    entityStatus: plainApplicant.entityStatus,
                    title: plainApplicant.title,
                    firstName: plainApplicant.firstName,
                    middleName: plainApplicant.middleName,
                    lastName: plainApplicant.lastName,
                    relationName: plainApplicant.relationName,
                    relationType: plainApplicant.relationType,
                    gender: plainApplicant.gender,
                    maritalStatus: plainApplicant.maritalStatus,
                    dateOfBirth: plainApplicant.dateOfBirth,
                    spouseName: plainApplicant.spouseName,
                    spouseDob: plainApplicant.spouseDob,
                    anniversaryDate: plainApplicant.anniversaryDate,
                    aadhar: plainApplicant.aadhar,
                    pan: plainApplicant.pan,
                    mobileCountryCode: plainApplicant.mobileCountryCode,
                    mobileNumber: plainApplicant.mobileNumber,
                    email: plainApplicant.email,
                    designation: plainApplicant.designation,
                    organizationName: plainApplicant.organizationName,
                    organizationType: plainApplicant.organizationType,
                    organizationAddress: plainApplicant.organizationAddress,
                    city: plainApplicant.city,
                    state: plainApplicant.state,
                    pincode: plainApplicant.pincode,
                    country: plainApplicant.country,
                    workExperience: plainApplicant.workExperience,
                    industrySector: plainApplicant.industrySector,
                    annualIncome: plainApplicant.annualIncome,
                    currentResidentStatus: plainApplicant.currentResidentStatus,
                    currentResidentType: plainApplicant.currentResidentType,
                    residentStatus: plainApplicant.residentStatus,
                    countryOfResidence: plainApplicant.countryOfResidence,
                    corrAddress: plainAddress.corrAddress,
                    corrCity: plainAddress.corrCity,
                    corrState: plainAddress.corrState,
                    corrPincode: plainAddress.corrPincode,
                    corrCountry: plainAddress.corrCountry,
                    permAddress: plainAddress.permAddress,
                    permCity: plainAddress.permCity,
                    permState: plainAddress.permState,
                    permPincode: plainAddress.permPincode,
                    permCountry: plainAddress.permCountry,
                    sameAsPermanent: plainAddress.sameAsPermanent
                };

                // console.log('Booking ID:', this.recordId);
                console.log('Applicant Data:', applicantWithAddress);

                // Convert to JSON string
                const jsonString = JSON.stringify(applicantWithAddress);
                // console.log('JSON String Length:', jsonString.length);

                // Call Apex method for each applicant
                const result = await createApplicantRecord({
                    bookingId: String(this.recordId),
                    applicantDetailsJson: jsonString
                });

                savedApplicantIds.push(result);
                console.log('Applicant saved with ID:', result);
                await this.attachApplicantFiles(result);
            }

            this.showToast(
                'Success',
                `${savedApplicantIds.length} applicant(s) saved successfully!`,
                'success'
            );
            return true;

        } catch (error) {
            console.error('Full Error:', error);
            console.error('Error Body:', JSON.stringify(error));

            let errorMessage = 'Unknown error occurred';

            if (error.body) {
                if (error.body.message) {
                    errorMessage = error.body.message;
                } else if (error.body.pageErrors && error.body.pageErrors.length > 0) {
                    errorMessage = error.body.pageErrors[0].message;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            this.showToast('Error', errorMessage, 'error');
        } finally {
            this.isSaving = false;
        }
    }

    async attachApplicantFiles(applicantId) {
        try {
            const files = this.applicantFiles[applicantId];
            if (!files) return;

            if (files.frontAadhar?.length > 0) {

                await moveFilesToApplicant({
                    bookingId: this.recordId,
                    applicantId: applicantId,
                    documentIds: files.frontAadhar,
                    docType: 'Aadhar Card'
                });
            }

            if (files.backAadhar?.length > 0) {
                await moveFilesToApplicant({
                    bookingId: this.recordId,
                    applicantId: applicantId,
                    documentIds: files.backAadhar,
                    docType: 'Aadhar Card'
                });
            }

            if (files.pan?.length > 0) {
                await moveFilesToApplicant({
                    bookingId: this.recordId,
                    applicantId: applicantId,
                    documentIds: files.pan,
                    docType: 'PAN Card'
                });
            }

            if (files.other?.length > 0) {
                await moveFilesToApplicant({
                    bookingId: this.recordId,
                    applicantId: applicantId,
                    documentIds: files.other,
                    docType: this.selectedDocType
                });
            }

        } catch (error) {
            console.error('Error attaching files:', error);
            // this.showToast('Error', 'Error while attaching files', 'error');
        }
    }

    async handleSaveAndPreview() {
        this.showSpinner = true;
        console.log('this.showSpinner', this.showSpinner);
        const isSaved = await this.handleSave();

        if (!isSaved) {
            // ❌ VALIDATION FAILED → STOP HERE
            this.showSpinner = false;
            return;
        }
        await this.fetchExistingApplicants();
        this.currentStage = 'Verify Details';
        this.showSpinner = false;
        this.isPreview = true;
        this.isSubmit = false;
    }

    handleBackToApplicantDetails() {
        this.currentStage = 'Submit Details';
        this.isSubmit = true;
        this.isPreview = false;
    }

    handleSubmit() {

        console.log('Submit clickedd.......')
    }


    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}
