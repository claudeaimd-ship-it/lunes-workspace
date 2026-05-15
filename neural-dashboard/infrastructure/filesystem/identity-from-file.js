// Adaptador: lee la identidad del agente desde IDENTITY.md

import fs from 'fs'
import path from 'path'
import { IdentityReader } from '../../domain/ports/identity-reader.js'

const HOME = process.env.HOME
const IDENTITY_PATH = path.join(HOME, '.openclaw/workspace/IDENTITY.md')

export class IdentityFromFile extends IdentityReader {
  readAgentIdentity() {
    try {
      const content = fs.readFileSync(IDENTITY_PATH, 'utf-8')
      const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/)
      const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/)
      return {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown Agent',
        emoji: emojiMatch ? emojiMatch[1].trim() : '🤖'
      }
    } catch (e) {
      return { name: 'Unknown Agent', emoji: '🤖' }
    }
  }
}
