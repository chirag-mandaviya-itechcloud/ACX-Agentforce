import { api, LightningElement, track } from "lwc";
const MESSAGE_CONTENT_CLASS = "embedded-messaging-message-content";
const ENDUSER = "EndUser";
const AGENT = "Agent";
const CHATBOT = "Chatbot";
const PARTICIPANT_TYPES = [ENDUSER, AGENT, CHATBOT];
const CHAT_CONTENT_CLASS = 'chat-content';


export default class CustomTextMessageBubble extends LightningElement {
    @track strMessage = '';

    //Add a var to track visibility for the component
    @track isBaseTextVisible = false;
    @track loadLWC = false;
    @track loadCaseLWC = false;
    messageStyle;

    /**
     * Deployment configuration data.
     * @type {Object}
     */
    @api configuration;

    /**
     * Conversation entry data.
     * @type {Object}
     */
    @api conversationEntry;

    /**
     * Returns the sender of this conversation entry.
     * @returns {string}
     */
    get sender() {
        return this.conversationEntry.sender && this.conversationEntry.sender.role;
    }

    /**
     * Returns the text content of the conversation entry.
     * @returns {string}
     */
    get textContent() {
        try {
            const entryPayload = JSON.parse(this.conversationEntry.entryPayload);
            if (
                entryPayload.abstractMessage &&
                entryPayload.abstractMessage.staticContent
            ) {
                const text = entryPayload.abstractMessage.staticContent.text;
                return text.replace(
                    // innerText or textContent
                    /(?:(?:ht|f)tp(?:s?)\:\/\/|~\/|\/)?(?:\w+:\w+@)?((?:(?:[-\w\d{1-3}]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|edu|co\.uk|ac\.uk|it|fr|tv|museum|asia|local|travel|[a-z]{2}))|((\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)(\.(\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)){3}))(?::[\d]{1,5})?(?:(?:(?:\/(?:[-\w~!$+|.,=]|%[a-f\d]{2})+)+|\/)+|\?|#)?(?:(?:\?(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)(?:&(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)*)*(?:#(?:[-\w~!$ |\/.,*:;=]|%[a-f\d]{2})*)?/g,
                    function (imgUrl) {
                        // Only switch out to specific shortened urls if the agent is the user.
                        if (this.sender === AGENT) {
                            // If the url is a specific link, then return a custom shortened link.
                            if (
                                imgUrl === "https://www.test.com/specificLink" ||
                                imgUrl === "https://www.test.com/anotherSpecificLink"
                            ) {
                                return `<a target="_blank" href="${imgUrl}">View Link</a>`;
                            }
                            // Otherwise just shorten to a generic link "View Article".
                            return `<a target="_blank" href="${imgUrl}">View Article</a>`;
                        }
                        return imgUrl;
                    }.bind(this),
                );
            }
            return "";
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Returns the class name of the message bubble.
     * @returns {string}
     */
    get generateMessageBubbleClassname() {
        if (this.isSupportedSender()) {
            return `${MESSAGE_CONTENT_CLASS} ${this.sender}`;
        } else {
            throw new Error(`Unsupported participant type passed in: ${this.sender}`);
        }
    }

    /**
     * True if the sender is a support participant type.
     * @returns {Boolean}
     */
    isSupportedSender() {
        return PARTICIPANT_TYPES.some(
            (participantType) => this.sender === participantType,
        );
    }



    connectedCallback() {
        //Set message string
        this.strMessage = this.textContent;
        console.log('straMessage', this.strMessage);
        //if (this.isSupportedUserType(this.userType))
        {
            //if using a lwc, remove any emojis that may have been inserted by the bot (ie :D or :p )
            if (this.sender == 'Chatbot' && this.strMessage.startsWith('lwc')) {
                this.strMessage = this.strMessage.replace(/😀/g, ':D').replace(/😛/g, ':p');
            }

            if (this.sender == 'Chatbot' && this.strMessage.startsWith('lwc:lead')) {
                this.loadLWC = true;
            }
            else if (this.sender == 'Chatbot' && this.strMessage.startsWith('lwc:case')) {
                this.loadCaseLWC = true;
            }

            //Add an elseif to show ur component....


            //ELSE SHOW BASE CHAT MESSAGE
            else if (!this.strMessage.startsWith('lwc:hide')) {
                console.log('Hide1111--');

                this.isBaseTextVisible = true;
                this.messageStyle = `${CHAT_CONTENT_CLASS} ${this.sender}`;
                console.log('messageStyle--', this.messageStyle);

            }
        }
    }


    handlePostMessage(event) {
        const dateValue = event.detail;
        console.log('Handling Event with value: ' + dateValue);

        // Get the embedded messaging instance
        const embeddedservice_bootstrap = window.parent.embeddedservice_bootstrap;

        // Send a message
        if (embeddedservice_bootstrap) {
            embeddedservice_bootstrap.utilAPI.sendTextMessage(dateValue);
        }

        /*window.postMessage(
            {
                message: dateValue,
                type: "EndUser"
            },
            window.parent.location ? window.parent.location.href : window.location.href
        );*/
    }
}
