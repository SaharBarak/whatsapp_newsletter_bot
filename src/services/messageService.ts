import { insertOne, findOne } from '../clients/mongoClient.js';
import { describeImage } from '../gateways/vertexGateway.js';
import config from '../config/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WAWebJS, { Message, Contact, Chat } from 'whatsapp-web.js';
import { RecentGroupMessage } from '../types/RecentGroupMessage.js';
import { fromGroupMessage } from '../types/predicates/fromGroupMessage.js';
import { hasusCommand } from './openaiService.js';
import { sendGroupMessage } from './groupService.js';
import db from '../clients/mongoClient.js';

interface IMessage {
  body: string;
  sender: string;
  timestamp: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imageDir = path.join(__dirname, '../../../public/images');
const HASUS_IDENTIFIER = "[חסוס]";

// Ensure the directory exists
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}

export async function handleMessage(
  msg: Message
) {
  try {
    const chat: Chat = await msg.getChat();
    if (chat.isGroup && chat.name === config.groupName) {
      const contact: Contact = await msg.getContact();
      const senderName: string = contact.name || contact.pushname || contact.number;
      console.log(`${senderName} has commented`);

      if (msg.type === 'chat') {
        await handleTextMessage(msg, senderName);
      } else if (msg.type === 'image' && msg.hasMedia) {
        await handleImageMessage(msg, senderName);
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

export async function handleOutgoingMessage(
  msg: Message
) {
  if (msg.body.includes(HASUS_IDENTIFIER)) {
    console.log("Skipping message from חסוס");
    return;
  }
  try {
    const chat: Chat = await msg.getChat();
    if (chat.isGroup && chat.name === config.groupName) {
      console.log('You have commented');

      const senderName = 'סהר ברק';

      if (msg.type === 'chat') {
        await handleTextMessage(msg, senderName);
      } else if (msg.type === 'image' && msg.hasMedia) {
        await handleImageMessage(msg, senderName);
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

export async function handleTextMessage(
  msg: Message,
   senderName: string
  ) {
  const message = {
    groupName: msg.from,
    body: msg.body,
    timestamp: msg.timestamp,
    sender: senderName,
    type: msg.type,
    hasMedia: msg.hasMedia ? 1 : 0,
    date: new Date(msg.timestamp * 1000).toISOString(),
  };

  // Check if the message already exists in the database
  const existingMessage = await findOne('messages', {
    groupName: message.groupName,
    body: message.body,
    sender: message.sender,
    timestamp: message.timestamp,
  });

  // Only add the message if it doesn't already exist
  if (!existingMessage) {
    await insertOne('messages', message);
    console.log(`Text message by ${senderName} saved.`);
  } else {
    console.log('Text message already exists in the database');
  }
}

export async function handleImageMessage(
  msg: Message,
   senderName: string
  ) {
  const message: RecentGroupMessage = fromGroupMessage(msg, senderName);

  // Check if the message already exists in the database
  const existingMessage = await findOne('messages', {
    groupName: message.groupName,
    body: message.body,
    sender: message.senderName,
    timestamp: message.timestamp,
  });

  // Only add the message if it doesn't already exist
  if (!existingMessage) {
    try {
      const media = await msg.downloadMedia();
      const imagePath = path.join(imageDir, `${msg.timestamp}.jpg`);
      fs.writeFileSync(imagePath, media.data, 'base64');
      console.log('Image saved:', imagePath);

      // Process image description
      const description = await describeImage(media.data);
      message.description = description;
      console.log('Image description processed:', description);

      await insertOne('messages', message);
      console.log(`Image message by ${senderName} saved.`);
    } catch (error) {
      console.error('Error downloading or processing media:', error);
    }
  } else {
    console.log('Image message already exists in the database');
  }
}

export async function handleHasusCommand(
  msg: WAWebJS.Message
): Promise<void> {
  const contact = (await msg.getContact()) || null;
  const senderName = contact.name || contact.pushname || contact.number || 'סהר';

  try {
    const prompt = msg.body.replace('/חסוס ', '');
    // Fetch the last 25 messages
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60; // Calculate timestamp for 7 days ago
    const documents = await db.find(
      'messages',
      { groupName: msg.from, timestamp: { $gte: oneWeekAgo } }, // Add condition for timestamp
      { sort: { timestamp: -1 } },
    );

    // Convert documents to Message type
    const messages: IMessage[] = documents.map((doc: any) => ({
      body: doc.body as string,
      sender: doc.sender as string,
      timestamp: doc.timestamp as number,
    }));

    const last25Messages = messages.reverse().map((m) => ({
      body: m.body,
      sender: m.sender,
      date: new Date(m.timestamp * 1000).toLocaleString('he-IL'),
    }));

    // Generate a response using OpenAI
    const formattedMessages = last25Messages
      .map((m) => `${m.date} - ${m.sender}: ${m.body}`)
      .join('\n');
      
    const response = await hasusCommand(formattedMessages, prompt, senderName);
    // Send the response to the group
    await sendGroupMessage(config.groupName as string, response);
    console.log(`Hasus replied: ${response}`);
  } catch (error) {
    console.error('Error handling /hasus command:', error);
  }
}

