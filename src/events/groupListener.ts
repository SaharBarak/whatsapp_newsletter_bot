import whatsappClient from "../clients/whatsappClient.js";
import config from "../config/config.js";
import { handleHasusCommand } from '../services/openaiService.js';
import { handleMessage, handleOutgoingMessage } from '../services/messageService.js';
import pkg, { Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { performSearch } from "../services/searchService.js";
import { sendGroupMessage } from "../services/groupService.js";

whatsappClient.on('ready', () => {
    console.log('WhatsApp client is ready!');
    listenToGroup(config.groupName);
  });
  
  whatsappClient.on('qr', (qr: string) => {
    qrcode.generate(qr, { small: true });
    console.log(qr);
  });
  
  whatsappClient.on('message', async (msg: Message) => {
    if (msg.body.startsWith('/חסוס ')) {
      await handleHasusCommand(msg);
    }
    if (msg.body.startsWith('/חפוש')) {
        const query = msg.body.slice(6).trim();
        sendGroupMessage(config.groupName, await performSearch(query));
    } else {
      await handleMessage(msg);
    }
  });
  
  whatsappClient.on('message_create', async (msg: Message) => {
    if (msg.body.startsWith('/חסוס ') && msg.fromMe) {
      await handleHasusCommand(msg);
    } else {
      if (msg.fromMe) {
        await handleOutgoingMessage(msg);
      }
    }
  });
  
  async function listenToGroup(groupName: string) {
    console.log(`trying to connect ${groupName}`);
    const chats = await whatsappClient.getChats();
    const group = chats.find((chat) => chat.isGroup && chat.name === groupName);
    if (group) {
      console.log(`Listening to group: ${groupName}`);
    } else {
      console.error(`Group ${groupName} not found`);
    }
  }
  