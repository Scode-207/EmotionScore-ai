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
import { fallbackStorage } from "./fallback-storage";

const PostgresSessionStore = connectPg(session);

// Define the storage interface here
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

/**
 * Resilient storage that attempts database operations first,
 * falling back to in-memory storage on database failures
 */
export class ResilientStorage implements IStorage {
  private usingFallback = false;
  sessionStore: session.Store;

  constructor() {
    try {
      this.sessionStore = new PostgresSessionStore({ 
        pool, 
        createTableIfMissing: true 
      });
      console.log("🟢 Successfully connected to database with session storage");
    } catch (error) {
      console.error("🔴 Failed to connect to database for session storage:", error);
      this.sessionStore = fallbackStorage.sessionStore;
      this.usingFallback = true;
    }
  }

  // Helper to execute a database operation with fallback
  private async executeWithFallback<T>(
    dbOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>
  ): Promise<T> {
    try {
      // Always use fallback in deployed environment if already set
      if (this.usingFallback) {
        return await fallbackOperation();
      }
      
      // Try to execute the database operation with a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Database operation timed out")), 5000);
      });
      
      // Race between the actual operation and a timeout
      const result = await Promise.race([dbOperation(), timeoutPromise]);
      return result as T;
    } catch (error) {
      // Log more details about the error
      console.error("Database operation failed, switching to memory storage fallback.");
      console.error("Error details:", error);
      
      // Always use fallback after any database failure
      this.usingFallback = true;
      
      // Try to reconnect to the database periodically
      if (!this._reconnectionScheduled) {
        this._reconnectionScheduled = true;
        setTimeout(() => {
          console.log("Attempting to reconnect to database...");
          this.testDatabaseConnection()
            .then(isConnected => {
              if (isConnected) {
                console.log("Successfully reconnected to database");
                this.usingFallback = false;
              } else {
                console.log("Still cannot connect to database, continuing with fallback");
              }
              this._reconnectionScheduled = false;
            })
            .catch(err => {
              console.error("Error during reconnection attempt:", err);
              this._reconnectionScheduled = false;
            });
        }, 30000); // Try reconnection after 30 seconds
      }
      
      return await fallbackOperation();
    }
  }
  
  // Added to test database connection
  private _reconnectionScheduled = false;
  
  private async testDatabaseConnection(): Promise<boolean> {
    try {
      // Simple query to test connection
      await db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      console.error("Database connection test failed:", error);
      return false;
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.executeWithFallback(
      async () => {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
      },
      async () => fallbackStorage.getUser(id)
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.executeWithFallback(
      async () => {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user;
      },
      async () => fallbackStorage.getUserByUsername(username)
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.executeWithFallback(
      async () => {
        const [user] = await db.select().from(users).where(eq(users.email, email));
        return user;
      },
      async () => fallbackStorage.getUserByEmail(email)
    );
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    return this.executeWithFallback(
      async () => {
        const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
        return user;
      },
      async () => fallbackStorage.getUserByFirebaseUid(firebaseUid)
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.executeWithFallback(
      async () => {
        const [user] = await db
          .insert(users)
          .values({
            ...insertUser,
            firebaseUid: null,
            displayName: null,
            photoURL: null,
            createdAt: new Date(),
            lastActive: new Date()
          })
          .returning();
        return user;
      },
      async () => fallbackStorage.createUser(insertUser)
    );
  }

  async createFirebaseUser(insertUser: InsertFirebaseUser): Promise<User> {
    return this.executeWithFallback(
      async () => {
        const [user] = await db
          .insert(users)
          .values({
            ...insertUser,
            username: insertUser.username || null,
            password: null,
            createdAt: new Date(),
            lastActive: new Date()
          })
          .returning();
        return user;
      },
      async () => fallbackStorage.createFirebaseUser(insertUser)
    );
  }

  async updateUserLastActive(id: number): Promise<User | undefined> {
    return this.executeWithFallback(
      async () => {
        const now = new Date();
        const [user] = await db
          .update(users)
          .set({ lastActive: now })
          .where(eq(users.id, id))
          .returning();
        return user;
      },
      async () => fallbackStorage.updateUserLastActive(id)
    );
  }

  // Chat methods
  async getChats(userId: number): Promise<Chat[]> {
    return this.executeWithFallback(
      async () => {
        return await db
          .select()
          .from(chats)
          .where(eq(chats.userId, userId))
          .orderBy(desc(chats.lastMessageAt));
      },
      async () => fallbackStorage.getChats(userId)
    );
  }

  async createChat(insertChat: InsertChat): Promise<Chat> {
    return this.executeWithFallback(
      async () => {
        const now = new Date();
        const [chat] = await db
          .insert(chats)
          .values({
            ...insertChat,
            echoEnhancedSearch: insertChat.echoEnhancedSearch || false,
            azureReasoning: false,
            createdAt: now,
            lastMessageAt: now
          })
          .returning();
        return chat;
      },
      async () => fallbackStorage.createChat(insertChat)
    );
  }

  async getChat(id: number): Promise<Chat | undefined> {
    return this.executeWithFallback(
      async () => {
        const [chat] = await db.select().from(chats).where(eq(chats.id, id));
        return chat;
      },
      async () => fallbackStorage.getChat(id)
    );
  }

  async updateChatSearchPreference(id: number, useEchoEnhanced: boolean): Promise<Chat | undefined> {
    return this.executeWithFallback(
      async () => {
        const [chat] = await db
          .update(chats)
          .set({ echoEnhancedSearch: useEchoEnhanced })
          .where(eq(chats.id, id))
          .returning();
        return chat;
      },
      async () => fallbackStorage.updateChatSearchPreference(id, useEchoEnhanced)
    );
  }

  async updateChatAzureReasoning(id: number, useAzureReasoning: boolean): Promise<Chat | undefined> {
    return this.executeWithFallback(
      async () => {
        const [chat] = await db
          .update(chats)
          .set({ azureReasoning: useAzureReasoning })
          .where(eq(chats.id, id))
          .returning();
        return chat;
      },
      async () => fallbackStorage.updateChatAzureReasoning(id, useAzureReasoning)
    );
  }

  // Message methods
  async getMessages(chatId: number): Promise<Message[]> {
    return this.executeWithFallback(
      async () => {
        return await db
          .select()
          .from(messages)
          .where(eq(messages.chatId, chatId))
          .orderBy(messages.createdAt);
      },
      async () => fallbackStorage.getMessages(chatId)
    );
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    return this.executeWithFallback(
      async () => {
        const now = new Date();
        // Create message
        const [message] = await db
          .insert(messages)
          .values({
            ...insertMessage,
            vadScore: insertMessage.vadScore || null,
            sentiment: insertMessage.sentiment || null,
            citations: insertMessage.citations || null,
            createdAt: now
          })
          .returning();
        
        // Update chat lastMessageAt
        await db
          .update(chats)
          .set({ lastMessageAt: now })
          .where(eq(chats.id, insertMessage.chatId));
        
        return message;
      },
      async () => fallbackStorage.createMessage(insertMessage)
    );
  }
}

// Create a singleton instance
export const resilientStorage = new ResilientStorage();