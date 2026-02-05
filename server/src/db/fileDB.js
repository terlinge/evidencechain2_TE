import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class FileDB {
  constructor(collection) {
    this.filePath = path.join(DATA_DIR, `${collection}.json`);
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  read() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${this.filePath}:`, error);
      return [];
    }
  }

  write(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error writing ${this.filePath}:`, error);
      return false;
    }
  }

  findAll() {
    return this.read();
  }

  findById(id) {
    const data = this.read();
    return data.find(item => item._id === id);
  }

  findOne(query) {
    const data = this.read();
    return data.find(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  find(query) {
    const data = this.read();
    if (!query || Object.keys(query).length === 0) {
      return data;
    }
    return data.filter(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  insert(item) {
    const data = this.read();
    const newItem = {
      _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...item,
      createdAt: new Date().toISOString(),
    };
    data.push(newItem);
    this.write(data);
    return newItem;
  }

  update(id, updates) {
    const data = this.read();
    const index = data.findIndex(item => item._id === id);
    if (index === -1) return null;
    
    data[index] = {
      ...data[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.write(data);
    return data[index];
  }

  delete(id) {
    const data = this.read();
    const filtered = data.filter(item => item._id !== id);
    if (filtered.length === data.length) return false;
    this.write(filtered);
    return true;
  }

  deleteMany(query) {
    const data = this.read();
    const filtered = data.filter(item => {
      return !Object.keys(query).every(key => item[key] === query[key]);
    });
    const deletedCount = data.length - filtered.length;
    if (deletedCount > 0) {
      this.write(filtered);
    }
    return deletedCount;
  }
}

export default FileDB;
