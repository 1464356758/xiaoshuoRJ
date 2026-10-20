package cn.aiworkspace.personal;
public final class Schema {
 public static final String[] SQL={
  "CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL)",
  "CREATE TABLE providers(id TEXT PRIMARY KEY,data TEXT NOT NULL,updated INTEGER NOT NULL)",
  "CREATE TABLE chats(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),title TEXT NOT NULL,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL)",
  "CREATE TABLE messages(id TEXT PRIMARY KEY,chat_id TEXT NOT NULL REFERENCES chats(id),role TEXT NOT NULL CHECK(role IN ('user','assistant')),body TEXT NOT NULL,state TEXT NOT NULL,data TEXT NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE requests(id TEXT PRIMARY KEY,chat_id TEXT NOT NULL REFERENCES chats(id),assistant_id TEXT NOT NULL UNIQUE REFERENCES messages(id),status TEXT NOT NULL,data TEXT NOT NULL,created INTEGER NOT NULL)",
  "CREATE TABLE files(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL)",
  "CREATE INDEX messages_chat ON messages(chat_id,created)",
  "CREATE INDEX chats_project ON chats(project_id,updated)",
  "CREATE INDEX requests_chat ON requests(chat_id,created)"
 };
}
