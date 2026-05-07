export interface NoteSection {
  id: string;
  title: string;
  content: string;
  language: string;
}

export interface Module {
  id: string;
  moduleName: string;
  sections: NoteSection[];
}

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'sql'
  | 'shell'
  | 'plaintext';

export const LANGUAGES: { value: SupportedLanguage; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell' },
  { value: 'plaintext', label: 'Plain Text' },
];
