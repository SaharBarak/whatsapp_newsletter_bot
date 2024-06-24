import { fetchGroupHeader, fetchGroupImages } from './groupService.js';
import { generateSummary } from '../gateways/openAIGateway.js';
import { processImageDescriptions } from './visionService.js';
import { find } from '../database/mongoClient.js';

function simplifyMessageForLog(message) {
    const { body, timestamp, from, to, author, type, hasMedia } = message;
    return { body, timestamp, from, to, author, type, hasMedia };
}

function simplifyMessageForAPI(message) {
    const { body, timestamp, sender, type, date } = message;
    return { body, timestamp, sender, type, date };
}

async function fetchAndProcessMessages(groupName) {
    const messages = await find('messages', { groupName });
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    const recentMessages = await Promise.all(messages.map(async msg => {
        if (msg.timestamp * 1000 >= oneWeekAgo) {
            return {
                senderName: msg.sender,
                body: msg.body,
                timestamp: msg.timestamp,
                sender: msg.sender,
                type: msg.type,
                hasMedia: msg.hasMedia,
                date: new Date(msg.timestamp).toLocaleString('he-IL') // Use Hebrew locale
            };
        }
        return null;
    }));

    return recentMessages.filter(msg => msg !== null);
}

export async function generateNewsletterText(groupName, prompt) {
    const recentMessages = await fetchAndProcessMessages(groupName);
    const imageDescriptions = await processImageDescriptions(recentMessages);

    const combinedMessages = [
        ...recentMessages.filter(msg => msg.type === 'chat'),
        ...imageDescriptions
    ];

    combinedMessages.sort((a, b) => a.timestamp - b.timestamp);

    const simplifiedMessagesForAPI = combinedMessages.map(msg => simplifyMessageForAPI(msg));

    const finalSummary = await generateSummary(simplifiedMessagesForAPI, prompt);

    return finalSummary;
}

export async function generateNewsletterObject(groupName, prompt) {
    const groupHeader = await fetchGroupHeader(groupName);
    const newsletterText = await generateNewsletterText(groupName, prompt);

    const summaryArray = newsletterText.split('\n\n').map(paragraph => paragraph.trim()).filter(paragraph => paragraph.length > 0);

    const imageUrls = await fetchGroupImages(groupName);

    return {
        groupName: groupHeader.name,
        summaries: summaryArray, // No visuals, just summaries
        images: imageUrls
    };
}
