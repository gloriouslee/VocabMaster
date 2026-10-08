import type { WordType } from '@/types';

export interface StarterWord {
  word: string;
  wordType: WordType;
  meaning: string;
  example: string;
  level: string;
}

export interface StarterTopic {
  folder: string;
  words: StarterWord[];
}

/** A small, hand-checked set of common IELTS Academic words so new learners can start immediately. */
export const STARTER_PACK: StarterTopic[] = [
  {
    folder: 'Environment',
    words: [
      { word: 'mitigate', wordType: 'verb', meaning: 'giảm nhẹ, làm dịu bớt', example: 'Governments must act to mitigate the effects of climate change.', level: 'Band 7.0' },
      { word: 'sustainable', wordType: 'adjective', meaning: 'bền vững', example: 'Sustainable farming protects the soil for future generations.', level: 'Band 6.5' },
      { word: 'deforestation', wordType: 'noun', meaning: 'nạn phá rừng', example: 'Deforestation has destroyed habitats across the region.', level: 'Band 7.0' },
      { word: 'emission', wordType: 'noun', meaning: 'khí thải, sự phát thải', example: 'Cars are a major source of carbon emissions.', level: 'Band 6.5' },
      { word: 'renewable', wordType: 'adjective', meaning: 'có thể tái tạo', example: 'Renewable energy is becoming cheaper every year.', level: 'Band 6.5' },
      { word: 'biodiversity', wordType: 'noun', meaning: 'đa dạng sinh học', example: 'Protecting biodiversity is vital for a healthy planet.', level: 'Band 7.0' },
      { word: 'pollutant', wordType: 'noun', meaning: 'chất gây ô nhiễm', example: 'Factories release harmful pollutants into rivers.', level: 'Band 7.0' },
      { word: 'conserve', wordType: 'verb', meaning: 'bảo tồn, tiết kiệm', example: 'We must conserve water during long droughts.', level: 'Band 6.5' },
    ],
  },
  {
    folder: 'Education',
    words: [
      { word: 'curriculum', wordType: 'noun', meaning: 'chương trình giảng dạy', example: 'The curriculum now includes digital skills.', level: 'Band 6.5' },
      { word: 'literacy', wordType: 'noun', meaning: 'khả năng đọc viết', example: 'Adult literacy programmes help people find better jobs.', level: 'Band 7.0' },
      { word: 'tuition', wordType: 'noun', meaning: 'học phí', example: 'Rising tuition fees put pressure on students.', level: 'Band 6.5' },
      { word: 'vocational', wordType: 'adjective', meaning: 'thuộc về hướng nghiệp', example: 'Vocational training prepares students for specific careers.', level: 'Band 7.0' },
      { word: 'compulsory', wordType: 'adjective', meaning: 'bắt buộc', example: 'Education is compulsory until the age of sixteen.', level: 'Band 6.5' },
      { word: 'assess', wordType: 'verb', meaning: 'đánh giá', example: 'Teachers assess students through coursework and exams.', level: 'Band 6.5' },
      { word: 'peer', wordType: 'noun', meaning: 'bạn đồng trang lứa', example: 'Children learn a lot from their peers.', level: 'Band 6.5' },
      { word: 'enrol', wordType: 'verb', meaning: 'đăng ký nhập học', example: 'More adults now enrol in evening courses.', level: 'Band 6.5' },
    ],
  },
  {
    folder: 'Technology',
    words: [
      { word: 'innovation', wordType: 'noun', meaning: 'sự đổi mới, sáng kiến', example: 'Innovation drives economic growth.', level: 'Band 6.5' },
      { word: 'obsolete', wordType: 'adjective', meaning: 'lỗi thời', example: 'Many old devices have become obsolete.', level: 'Band 7.0' },
      { word: 'automate', wordType: 'verb', meaning: 'tự động hóa', example: 'Factories automate tasks to cut costs.', level: 'Band 7.0' },
      { word: 'surveillance', wordType: 'noun', meaning: 'sự giám sát', example: 'Public surveillance raises privacy concerns.', level: 'Band 7.5' },
      { word: 'breakthrough', wordType: 'noun', meaning: 'bước đột phá', example: 'Scientists announced a breakthrough in cancer research.', level: 'Band 7.0' },
      { word: 'digital divide', wordType: 'phrase', meaning: 'khoảng cách số', example: 'The digital divide leaves rural communities behind.', level: 'Band 7.5' },
      { word: 'addictive', wordType: 'adjective', meaning: 'gây nghiện', example: 'Social media can be highly addictive.', level: 'Band 6.5' },
      { word: 'cutting-edge', wordType: 'adjective', meaning: 'tiên tiến nhất', example: 'The hospital uses cutting-edge technology.', level: 'Band 7.0' },
    ],
  },
  {
    folder: 'Society',
    words: [
      { word: 'inequality', wordType: 'noun', meaning: 'sự bất bình đẳng', example: 'Income inequality has widened in many countries.', level: 'Band 7.0' },
      { word: 'urbanisation', wordType: 'noun', meaning: 'quá trình đô thị hóa', example: 'Rapid urbanisation puts pressure on housing.', level: 'Band 7.0' },
      { word: 'unemployment', wordType: 'noun', meaning: 'tình trạng thất nghiệp', example: 'Youth unemployment remains a serious problem.', level: 'Band 6.5' },
      { word: 'stereotype', wordType: 'noun', meaning: 'định kiến rập khuôn', example: 'Media can reinforce harmful stereotypes.', level: 'Band 7.0' },
      { word: 'welfare', wordType: 'noun', meaning: 'phúc lợi', example: 'The government increased welfare spending.', level: 'Band 7.0' },
      { word: 'diversity', wordType: 'noun', meaning: 'sự đa dạng', example: 'Cultural diversity enriches city life.', level: 'Band 6.5' },
      { word: 'marginalised', wordType: 'adjective', meaning: 'bị gạt ra bên lề xã hội', example: 'Marginalised groups need better support.', level: 'Band 7.5' },
      { word: 'cohesion', wordType: 'noun', meaning: 'sự gắn kết', example: 'Shared activities improve social cohesion.', level: 'Band 7.5' },
    ],
  },
  {
    folder: 'Health',
    words: [
      { word: 'sedentary', wordType: 'adjective', meaning: 'ít vận động', example: 'A sedentary lifestyle increases health risks.', level: 'Band 7.5' },
      { word: 'obesity', wordType: 'noun', meaning: 'bệnh béo phì', example: 'Childhood obesity is rising worldwide.', level: 'Band 6.5' },
      { word: 'chronic', wordType: 'adjective', meaning: 'mãn tính', example: 'Chronic illnesses require long-term care.', level: 'Band 7.0' },
      { word: 'preventive', wordType: 'adjective', meaning: 'mang tính phòng ngừa', example: 'Preventive care saves money in the long run.', level: 'Band 7.0' },
      { word: 'nutrition', wordType: 'noun', meaning: 'dinh dưỡng', example: 'Good nutrition supports healthy development.', level: 'Band 6.5' },
      { word: 'well-being', wordType: 'noun', meaning: 'sức khỏe và hạnh phúc', example: 'Exercise improves mental well-being.', level: 'Band 7.0' },
      { word: 'epidemic', wordType: 'noun', meaning: 'dịch bệnh lan rộng', example: 'The epidemic spread quickly through the city.', level: 'Band 7.0' },
      { word: 'deteriorate', wordType: 'verb', meaning: 'xấu đi, suy giảm', example: 'Her health began to deteriorate last winter.', level: 'Band 7.5' },
    ],
  },
];

export const STARTER_PACK_SIZE = STARTER_PACK.reduce((sum, topic) => sum + topic.words.length, 0);
