/** Small neighbourhood quests: who asks, what for, what you get. */
export interface QuestDef {
  id: string;
  giver: string;
  intro: string;
  /** shown while the quest is active */
  reminder: string;
  thanks: string;
  /** item to bring, or a number of dogs to feed */
  need: { item: 'wrench' | 'ball' } | { feed: number };
  reward: { coins: number; perk?: 'zinaFood' };
}

export const QUESTS: Record<string, QuestDef> = {
  zina: {
    id: 'zina',
    giver: 'Бабушка Зина',
    intro: 'Ой, милок, собачки-то голодные бегают… Покорми-ка троих, а я в долгу не останусь!',
    reminder: 'Покорми ещё собачек, сердце за них болит.',
    thanks: 'Вот спасибо! Подходи ко мне — всегда корма подсыплю.',
    need: { feed: 3 },
    reward: { coins: 30, perk: 'zinaFood' },
  },
  misha: {
    id: 'misha',
    giver: 'Дядя Миша',
    intro: 'Слушай, я гаечный ключ на пустыре у теплотрассы обронил. Найдёшь — с меня причитается!',
    reminder: 'Ключ где-то на пустыре, у трубы. Глянь в траве.',
    thanks: 'О, родной мой ключик! Держи, заработал.',
    need: { item: 'wrench' },
    reward: { coins: 40 },
  },
  kids: {
    id: 'kids',
    giver: 'Петя и Маша',
    intro: 'Наш мячик улетел за гаражи, в кусты у дороги! Поможешь?',
    reminder: 'Мячик в кустах у дороги, за гаражами!',
    thanks: 'Ура, мячик! Вот наши сбережения, держи!',
    need: { item: 'ball' },
    reward: { coins: 25 },
  },
};
