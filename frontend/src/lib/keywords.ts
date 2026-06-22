// frontend/src/lib/keywords.ts

// Common English stop words to ignore in financial news
const STOP_WORDS = new Set([
    "the", "and", "to", "of", "in", "for", "is", "on", "that", "by", 
    "this", "with", "i", "you", "it", "not", "or", "be", "are", "from", 
    "at", "as", "your", "all", "have", "new", "more", "an", "was", "we", 
    "will", "home", "can", "us", "about", "if", "page", "my", "has", 
    "says", "said", "over", "after", "its", "up", "down", "what", "who",
    "why", "how", "when", "where", "out", "into", "could", "would", "their"
  ]);
  
  export type GraphData = {
    nodes: { id: string; name: string; val?: number }[];
    links: { source: string; target: string }[];
  };
  
  export function buildKeywordGraph(headlines: string[]): GraphData {
    if (!headlines || headlines.length === 0) return { nodes: [], links: [] };
  
    const wordCounts: Record<string, number> = {};
    const headlineTokens: string[][] = [];
  
    // Step 1: Tokenize and count frequencies
    headlines.forEach((headline) => {
      // Extract words, convert to lowercase, remove punctuation
      const words = headline.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      
      // Filter out stop words and keep unique words per headline
      const uniqueValidWords = Array.from(new Set(words.filter(w => !STOP_WORDS.has(w))));
      headlineTokens.push(uniqueValidWords);
  
      uniqueValidWords.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });
  
    // Step 2: Keep only the top 30 most frequent keywords (to prevent graph clutter)
    const topWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(entry => entry[0]);
    
    const topWordsSet = new Set(topWords);
  
    // Step 3: Build Nodes
    const nodes = topWords.map(word => ({
      id: word,
      name: word.toUpperCase(), // Uppercase for terminal aesthetic
      val: wordCounts[word] // Size of the node
    }));
  
    // Step 4: Build Links (Co-occurrence)
    const links: { source: string; target: string }[] = [];
    const linkSet = new Set<string>(); // To prevent duplicate links
  
    headlineTokens.forEach(tokens => {
      // Only look at tokens that made it into our top keywords
      const relevantTokens = tokens.filter(t => topWordsSet.has(t));
      
      // Connect every keyword in this headline to every other keyword in this headline
      for (let i = 0; i < relevantTokens.length; i++) {
        for (let j = i + 1; j < relevantTokens.length; j++) {
          const source = relevantTokens[i];
          const target = relevantTokens[j];
          
          // Create a unique key for the edge (alphabetical so A->B and B->A are the same)
          const edgeKey = [source, target].sort().join("-");
          
          if (!linkSet.has(edgeKey)) {
            linkSet.add(edgeKey);
            links.push({ source, target });
          }
        }
      }
    });
  
    return { nodes, links };
  }