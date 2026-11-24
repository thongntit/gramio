export default function sampleWithoutReplacement(items, count) {
  const shuffled = [...items];
  const limit = Math.min(count, shuffled.length);
  for (let index = 0; index < limit; index += 1) {
    const swapIndex = index + Math.floor(Math.random() * (shuffled.length - index));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}
