#!/usr/bin/env tsx
/**
 * Fix all test fixtures to use self-contained mock types
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { readdirSync } from 'fs';

const fixturesDir = resolve(__dirname, 'fixtures');

const mockTypes = `// Mock database types for testing
type Database = {
  public: {
    Tables: {
      patients: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          zipcode: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['patients']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['patients']['Insert']>;
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          scheduled_at: string;
          status: string;
          notes: string | null;
          duration_minutes: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          name: string;
          sku: string;
          price: number;
          stock_quantity: number;
          description: string | null;
          category_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          quantity: number;
          movement_type: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_movements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inventory_movements']['Insert']>;
      };
    };
  };
};
`;

function fixFixture(filePath: string): void {
  let content = readFileSync(filePath, 'utf-8');
  
  // Remove the import line
  content = content.replace(/import.*from.*database\.types.*;\n\n?/g, '');
  
  // Add mock types at the top (after comments)
  const lines = content.split('\n');
  const commentEndIndex = lines.findIndex(line => !line.startsWith('//') && line.trim() !== '');
  
  if (commentEndIndex !== -1) {
    lines.splice(commentEndIndex, 0, mockTypes);
    content = lines.join('\n');
  }
  
  writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
}

// Process all fixtures
const rules = ['rule2-schema-drift', 'rule4-mapper-contract', 'rule7-diagnostic-inventory', 'rule10-repeated-pattern'];

for (const rule of rules) {
  const ruleDir = resolve(fixturesDir, rule);
  const files = readdirSync(ruleDir).filter(f => f.endsWith('.ts'));
  
  for (const file of files) {
    fixFixture(resolve(ruleDir, file));
  }
}

console.log('\n✅ All fixtures fixed');
