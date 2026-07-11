// Fotos reais das bases (batalhões, delegacias, UAIs, quartéis) usadas no jogo.
// Mantido separado de bases.json (que é regenerado por scripts/fetch-city-data.mjs)
// para não perder as fotos ao atualizar os dados do OSM.
//
// Para adicionar uma foto: salve a imagem em public/bases/<arquivo>.jpg e
// aponte o id da base (visível em bases.json) para "/bases/<arquivo>.jpg".
export const BASE_PHOTOS: Record<string, string> = {
  'way/300946872': '/bases/17-bpm.png', // Quartel do 17º BPM (Polícia Militar)
};
