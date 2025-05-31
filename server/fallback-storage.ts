import { 
  users, type User, type InsertUser, type InsertFirebaseUser,
  chats, type Chat, type InsertChat, 
  messages, type Message, type InsertMessage 
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Create an interface that matches our regular storage
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

// Create an in-memory fallback implementation
export class FallbackStorage implements IStorage {
  private users: User[] = [];
  private chats: Chat[] = [];
  private messages: Message[] = [];
  private nextUserId = 1;
  private nextChatId = 1;
  private nextMessageId = 1;
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    console.log("⚠️ Using in-memory fallback storage due to database connection issues");
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
    const now = new Date();
    const user: User = { 
      id, 
      firebaseUid: null,
      email: insertUser.email || '',
      displayName: null,
      photoURL: null,
      username: insertUser.username || null,
      password: insertUser.password || null,
      createdAt: now,
      lastActive: now
    };
    this.users.push(user);
    return user;
  }

  async createFirebaseUser(insertUser: InsertFirebaseUser): Promise<User> {
    const id = this.nextUserId++;
    const now = new Date();
    const user: User = { 
      id, 
      firebaseUid: insertUser.firebaseUid,
      email: insertUser.email,
      displayName: insertUser.displayName || null,
      photoURL: insertUser.photoURL || null,
      username: insertUser.username || null,
      password: null,
      createdAt: now,
      lastActive: now
    };
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
    const now = new Date();
    const chat: Chat = { 
      id, 
      userId: insertChat.userId,
      title: insertChat.title,
      createdAt: now,
      lastMessageAt: now, 
      echoEnhancedSearch: insertChat.echoEnhancedSearch || false, 
      azureReasoning: false 
    };
    this.chats.push(chat);
    return chat;
  }

  async getChat(id: number): Promise<Chat | undefined> {
    return this.chats.find(c => c.id === id);
  }

  async updateChatSearchPreference(id: number, useEchoEnhanced: boolean): Promise<Chat | undefined> {
    const chat = await this.getChat(id);
    if (chat) {
      chat.echoEnhancedSearch = useEchoEnhanced;
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
    const message: Message = { 
      id, 
      chatId: insertMessage.chatId,
      content: insertMessage.content,
      role: insertMessage.role,
      vadScore: insertMessage.vadScore || null,
      sentiment: insertMessage.sentiment || null,
      citations: insertMessage.citations || null,
      createdAt: new Date()
    };
    this.messages.push(message);
    
    // Update last message timestamp for the chat
    const chat = this.chats.find(c => c.id === insertMessage.chatId);
    if (chat) {
      chat.lastMessageAt = new Date();
    }
    
    return message;
  }
}

// Create a singleton instance
export const fallbackStorage = new FallbackStorage();