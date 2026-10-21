import { axiosClient } from '../api/axiosClient';

export interface LeaderboardEntry {
  team_id: string;
  team_name: string;
  topic_title: string;
  rank: number;
  final_score: number;
  eval_count: number;
  has_discrepancy?: boolean;
}

export interface PublishLeaderboardPayload {
  is_result_published: boolean;
}

export const evaluationService = {
  /**
   * Lấy danh mục các tiêu chí Rubric đánh giá từ BTC
   * GET /api/v1/rubrics
   */
  getRubrics: async () => {
    const response = await axiosClient.get('/rubrics');
    return response.data;
  },

  /**
   * Lấy Bảng xếp hạng chung cuộc (Leaderboard)
   * GET /api/v1/leaderboard
   */
  getLeaderboard: async () => {
    const response = await axiosClient.get('/leaderboard');
    return response.data;
  },

  /**
   * Admin công bố hoặc thu hồi bảng xếp hạng chính thức cho toàn bộ thí sinh
   * PATCH /api/v1/admin/leaderboard/publish
   */
  publishLeaderboard: async (payload: PublishLeaderboardPayload = { is_result_published: true }) => {
    const response = await axiosClient.patch('/admin/leaderboard/publish', payload);
    return response.data;
  },
};

export const {
  getRubrics,
  getLeaderboard,
  publishLeaderboard,
} = evaluationService;
