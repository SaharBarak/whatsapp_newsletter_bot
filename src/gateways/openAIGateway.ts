import { OpenAI } from 'openai';
import { GistRecentGroupMessage } from '../types/GistRecentGroupMessage.js'; 
import { time } from 'console';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const HASUS_IDENTIFIER = "[חסוס]";

export async function generateSummary(
  messagesJSON: GistRecentGroupMessage[],
  prompt?: string,
): Promise<string> {
  const defaultPrompt = `its a summary of all messages goes around our whatsapp group, your role is to be a bot that gets all the messages circulates through the group once a week for the week that has been and generate a funny as hell newsletter/weekly recap, it has to be in hebrew, it has to be chronological, you can be a sarcastic and personal, there is a thing in the group with people wearing personas of old people as their alter ego, you gotta catch on it, and mainly its a group that was created naturally around a community pub and workspace and vintage shop and hub, everyone in this group is related to the business in their way, galia runs the shop, matan and noa are the founders of the pub, bracha runs the hub, asaf and other people work there but its not a work group its a friends group.
                        asaf don't believe in ai it comments random shit trying to fail you,
                        the format that you return is basically paragraphs separated by two new lines, in chronological order, first present yourself, your name is חסוס(for now)
                        lets try to create prompts for this, make sure to speak proper hebrew, you make use slang words and phrases(as long as they're hebrew and israeli)`;

  const finalPrompt = prompt || defaultPrompt;

  try {
    const formattedMessages = formatMessagesForPrompt(messagesJSON);
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: finalPrompt },
        { role: 'user', content: formattedMessages },
      ],
      max_tokens: 2500,
    });

    if (response.choices[0].message.content) {
      return response.choices[0].message.content.trim();
    }
    throw new Error('No response from OpenAI');
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

export async function hasusCommand(
  messagesJSON: string,
  prompt: string,
  executerName: string,
): Promise<string> {
  const time = Date.now();
  const system = `You are an AI that is connected to our whatsapp group, your name is חסוס. its a summary of the last 30 messages went around our whatsapp group, figure out what they want from you, 
                        the date and time now is ${time}, understand the time and the chronological behaiviour of the messages, you can be a sarcastic and personal.
                        its a group that was created naturally around a community pub and workspace and vintage shop and hub, everyone in this group is related to the business in their way, galia runs the shop,
                        matan and noa are the founders of the pub, bracha runs the hub, asaf and other people work there but its not a work group its a friends group
                        asaf don't believe in ai and comments random shit trying to fail you,
                        make sure to speak proper hebrew, you make use slang words and phrases(as long as they're hebrew and israeli)
                        try to keep your responses short unless they ask you for a newsletter`;

  console.log(prompt, executerName, messagesJSON);

  let response;
    try {
      if (prompt.length === 0) {
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `${executerName} has called you` },
            { role: 'user', content: prompt },
            { role: 'user', content: messagesJSON },
          ],
          max_tokens: 5000,
        });
      } else {
         response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `${executerName} has called you` },
            { role: 'user', content: `speak proper hebrew, you may make use of slang words and phrases(as long as they're hebrew and israeli` },
            { role: 'user', content: 'You are an AI that is connected to our whatsapp group, your name is חסוס.'},
            { role: 'user', content: messagesJSON },
          ],
          max_tokens: 5000,
        });
      }

      if (response.choices[0].message.content) {
        return `${HASUS_IDENTIFIER}\n${response.choices[0].message.content.trim()}`;
      } else {
        throw new Error('No response from OpenAI');
      }

    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  return '';
}

function formatMessagesForPrompt(
  messages: GistRecentGroupMessage[]
): string {
  return messages.map((msg) => `${msg.date} - ${msg.sender}: ${msg.body}`).join('\n');
}
