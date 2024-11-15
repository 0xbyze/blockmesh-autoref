const { TempMail } = require("tempmail.lol");
const fs = require('fs');
const { faker } = require('@faker-js/faker');
const { createInterface } = require('readline');
const { ProxyAgent } = require('undici'); // Import ProxyAgent from undici
const displayHeader = require('./src/displayHeader');

displayHeader();
// Setup API key and TempMail instance | https://tempmail.lol << register for apikey or leave it empty
const API_KEY = '';
const tempmail = new TempMail(API_KEY);
const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Function to load proxies from a proxy.txt file
function loadProxies() {
    try {
        const data = fs.readFileSync('proxy.txt', 'utf-8');
        const proxies = data.split('\n').map(proxy => proxy.trim()).filter(proxy => proxy.length > 0);
        return proxies;
    } catch (error) {
        console.error('Error reading proxy.txt:', error);
        return [];
    }
}

// Get a random proxy from the loaded proxies
function getRandomProxy(proxies) {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
}

// Function to create and register
async function createAndRegister(refcode) {
    try {
        // Load proxies from proxy.txt
        const proxies = loadProxies();
        if (proxies.length === 0) {
            console.log("No proxies available. Proceeding without a proxy.");
        }

        // Step 1: Create a temporary inbox
        let inbox = await tempmail.createInbox();
        console.log(`Temporary email address created: ${inbox.address} with token: ${inbox.token}`);

        // Step 2: Generate a random password using Faker.js
        let randPass = faker.internet.password();
        console.log(`Generated Password: ${randPass}`);

        // Step 3: Register on BlockMesh using the temporary email and generated password
        const registrationData = new URLSearchParams({
            email: inbox.address,
            password: randPass,  // Randomly generated password
            password_confirm: randPass,  // Confirm the password
            invite_code: refcode  // Referral code from user input
        }).toString();

        const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Referer": `https://app.blockmesh.xyz/register?invite_code=${refcode}`,
        };

        // Proxy setup: Create a ProxyAgent if proxies are available
        const proxy = proxies.length > 0 ? getRandomProxy(proxies) : null;
        const proxyAgent = proxy ? new ProxyAgent(proxy) : null;
        console.log(`Using proxy: ${proxy}`)
        // Fetch request for registration with proxy if available
        const response = await fetch("https://app.blockmesh.xyz/register", {
            method: 'POST',
            headers: headers,
            body: registrationData,
            dispatcher: proxyAgent // Apply proxy if available
        });

        console.log(`Registration response: ${response.status} ${response.statusText}`);
        delay(1500)
        // Step 4: Check the inbox for the confirmation email (retry up to 10 times)
        const emails = await checkInboxWithRetry(inbox);

        if (!emails || emails.length === 0) {
            console.log("No emails received or inbox expired.");
            return;
        }

        console.log(`Found ${emails.length} email(s) in inbox.`);

        // Step 5: Loop through the emails to find the confirmation link
        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            console.log(`Checking email ${i + 1}: Subject - ${email.subject}`);

            if (email.subject.includes("Confirmation") || email.html.includes("confirm")) {
                console.log(`Found confirmation email: ${email.subject}`);
                
                // Extract the confirmation link from the AWS tracking URL
                const awsTrackingLinkMatch = email.html.match(/https:\/\/[a-z0-9.-]+\.awstrack\.me[^\s]+/);
                if (awsTrackingLinkMatch) {
                    const awsTrackingLink = awsTrackingLinkMatch[0];
                    console.log(`Found AWS tracking link: ${awsTrackingLink}`);

                    // Step 6: Extract the real confirmation link from the AWS tracking URL
                    const confirmationLink = extractConfirmationLink(awsTrackingLink);
                    console.log(`Extracted confirmation link: ${confirmationLink}`);

                    // Step 7: Confirm registration by visiting the real confirmation link
                    await fetch(confirmationLink, { dispatcher: proxyAgent }); // Use proxy for confirmation link as well
                    console.log("Registration confirmed.");

                    // Step 8: Save email and password to accounts.txt
                    saveCredentialsToFile(inbox.address, randPass);

                    break;
                } else {
                    console.log("No AWS tracking link found in the email body.");
                }
            }
        }
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

// Function to handle checking inbox with retry mechanism (retry limit set to 10)
async function checkInboxWithRetry(inbox) {
    let emails;
    const maxRetries = 10;  // Set max retries to 10
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            // Check inbox for emails
            emails = await tempmail.checkInbox(inbox.token);

            // If emails are found, return them
            if (emails && emails.length > 0) {
                console.log("Emails found in inbox.");
                return emails;
            }

            // No emails found, retry after delay
            console.log(`No emails found yet. Retrying... (${retryCount + 1}/${maxRetries})`);
            retryCount++;
            await delay(5000);  // Wait for 5 seconds before retrying
        } catch (error) {
            console.error("Error checking inbox:", error);
            retryCount++;
            await delay(5000);  // Wait before retrying in case of error
        }
    }

    console.log("Max retries reached. No emails found.");
    return emails;
}

// Helper function to introduce delay between retries
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to extract the real confirmation link from the AWS tracking URL
function extractConfirmationLink(awsTrackingLink) {
    const decodedLink = decodeURIComponent(awsTrackingLink.split("L0/")[1].split("/1/")[0]);
    return decodedLink;  // This should be something like: https://app.blockmesh.xyz/email_confirm?token=MR0DJCWPCWDOHYLA
}

// Function to get user input for the referral code
const getUserInput = () => {
    return new Promise((resolve) => {
        rl.question(
            'Input the full URL with the refcode: (e.g., https://app.blockmesh.xyz/register?invite_code=xxx) ',
            (answer) => {
                const refCode = extractRefCodeFromURL(answer);
                resolve(refCode);
            }
        );
    });
};

// Function to extract the `invite_code` from the URL
function extractRefCodeFromURL(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    const refCode = urlParams.get('invite_code');
    if (!refCode) {
        console.log("No invite_code found in the URL.");
        process.exit(1); // Exit if no refcode is found
    }
    return refCode;
}

// Function to save email and password to accounts.txt
function saveCredentialsToFile(email, password) {
    const credentials = `${email}:${password}\n`;
    
    // Append credentials to the accounts.txt file
    fs.appendFile('accounts.txt', credentials, (err) => {
        if (err) {
            console.error("Error saving credentials to file:", err);
        } else {
            console.log(`Credentials saved to accounts.txt: ${email}:${password}`);
        }
    });
}

// Main function to handle multiple registrations
(async () => {
    try {
        const targetRefCode = await getUserInput(); // Get ref code from user input URL
        rl.question('How many ref codes do you want to input? ', async (input) => {
            const looping = parseInt(input, 10);
            for (let index = 0; index < looping; index++) {
                await createAndRegister(targetRefCode);  // Register for each ref code
                await delay(1000);  // Wait for 1 second between registrations
            }
            rl.close(); // Close readline only after all actions are done
        });
    } catch (error) {
        console.error("Error during execution:", error);
        rl.close(); // Close readline in case of error as well
    }
})();
