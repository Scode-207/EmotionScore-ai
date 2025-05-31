import { 
  users, type User, type InsertUser, type InsertFirebaseUser,
  chats, type Chat, type InsertChat, 
  messages, type Message, type InsertMessage 
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createFirebaseUser(user: InsertFirebaseUser): Promise<User>;
  updateUserLastActive(id: number): Promise<User | undefined>;
  
  // Chat methods
  getChats(userId: number): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;
  getChat(id: number): Promise<Chat | undefined>;
  updateChatSearchPreference(id: number, useEchoEnhanced: boolean): Promise<Chat | undefined>;
  updateChatAzureReasoning(id: number, useAzureReasoning: boolean): Promise<Chat | undefined>;
  
  // Message methods
  getMessages(chatId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Session store
  sessionStore: session.Store;
}

// Temporarily use memory storage due to database connection issues
export class MemStorage implements IStorage {
  private users: User[] = [];
  private chats: Chat[] = [];
  private messages: Message[] = [];
  private nextUserId = 1;
  private nextChatId = 1;
  private nextMessageId = 1;
  sessionStore: any;

  constructor() {
    const MemoryStore = require('memorystore')(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    return this.users.find(u => u.firebaseUid === firebaseUid);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextUserId++;
    const user = { id, ...insertUser, lastActive: new Date() };
    this.users.push(user);
    return user;
  }

  async createFirebaseUser(insertUser: InsertFirebaseUser): Promise<User> {
    const id = this.nextUserId++;
    const user = { id, ...insertUser, lastActive: new Date() };
    this.users.push(user);
    return user;
  }

  async updateUserLastActive(id: number): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (user) {
      user.lastActive = new Date();
      return user;
    }
    return undefined;
  }

  async getChats(userId: number): Promise<Chat[]> {
    return this.chats.filter(c => c.userId === userId);
  }

  async createChat(insertChat: InsertChat): Promise<Chat> {
    const id = this.nextChatId++;
    const chat = { id, ...insertChat, echoEnhanced: false, azureReasoning: false };
    this.chats.push(chat);
    return chat;
  }

  async getChat(id: number): Promise<Chat | undefined> {
    return this.chats.find(c => c.id === id);
  }

  async updateChatSearchPreference(id: number, useEchoEnhanced: boolean): Promise<Chat | undefined> {
    const chat = await this.getChat(id);
    if (chat) {
      chat.echoEnhanced = useEchoEnhanced;
      return chat;
    }
    return undefined;
  }

  async updateChatAzureReasoning(id: number, useAzureReasoning: boolean): Promise<Chat | undefined> {
    const chat = await this.getChat(id);
    if (chat) {
      chat.azureReasoning = useAzureReasoning;
      return chat;
    }
    return undefined;
  }

  async getMessages(chatId: number): Promise<Message[]> {
    return this.messages.filter(m => m.chatId === chatId);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.nextMessageId++;
    const message = { id, ...insertMessage, createdAt: new Date() };
    this.messages.push(message);
    return message;
  }
}

// Comment out the database storage temporarily
// export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!username) return undefined;
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    if (!firebaseUid) return undefined;
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createFirebaseUser(insertUser: InsertFirebaseUser): Promise<User> {
    // Check if user already exists with this Firebase UID
    const existingUser = await this.getUserByFirebaseUid(insertUser.firebaseUid);
    if (existingUser) {
      // Update last active time
      return this.updateUserLastActive(existingUser.id) as Promise<User>;
    }

    // Create a new user
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserLastActive(id: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ lastActive: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  // Chat methods
  async getChats(userId: number): Promise<Chat[]> {
    return await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.lastMessageAt));
  }
  
  async createChat(insertChat: InsertChat): Promise<Chat> {
    const now = new Date();
    const [chat] = await db
      .insert(chats)
      .values({
        ...insertChat,
        createdAt: now,
        lastMessageAt: now
      })
      .returning();
    return chat;
  }
  
  async getChat(id: number): Promise<Chat | undefined> {
    const [chat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, id));
    return chat;
  }
  
  async updateChatSearchPreference(id: number, useEchoEnhanced: boolean): Promise<Chat | undefined> {
    const [chat] = await db
      .update(chats)
      .set({ echoEnhancedSearch: useEchoEnhanced })
      .where(eq(chats.id, id))
      .returning();
    return chat;
  }
  
  async updateChatAzureReasoning(id: number, useAzureReasoning: boolean): Promise<Chat | undefined> {
    const [chat] = await db
      .update(chats)
      .set({ azureReasoning: useAzureReasoning })
      .where(eq(chats.id, id))
      .returning();
    return chat;
  }
  
  // Message methods
  async getMessages(chatId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt); // Oldest first
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const now = new Date();
    
    // Update the chat's lastMessageAt timestamp
    await db
      .update(chats)
      .set({ lastMessageAt: now })
      .where(eq(chats.id, insertMessage.chatId));
    
    // Create the message
    const [message] = await db
      .insert(messages)
      .values({
        ...insertMessage,
        createdAt: now
      })
      .returning();
    
    return message;
  }
}

// Temporarily using memory storage due to database connection issues
export const storage = new MemStorage();
