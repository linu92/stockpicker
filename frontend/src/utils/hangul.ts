export const CHOSUNG_LIST = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

export function getChosung(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Hangul Syllables: 0xAC00 ~ 0xD7A3
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const chosungIndex = Math.floor((code - 0xAC00) / 588);
      result += CHOSUNG_LIST[chosungIndex];
    } else {
      result += text[i];
    }
  }
  return result;
}

export function isChosungMatch(query: string, targetName: string): boolean {
  if (!query) return false;
  
  // If query consists only of chosung characters, compare with chosung of target
  const isOnlyChosung = query.split('').every(char => CHOSUNG_LIST.includes(char) || char === ' ');
  
  if (isOnlyChosung) {
    const targetChosung = getChosung(targetName);
    return targetChosung.replace(/\s+/g, '').includes(query.replace(/\s+/g, ''));
  }
  
  return targetName.toLowerCase().includes(query.toLowerCase());
}
