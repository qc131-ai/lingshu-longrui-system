import type { Competition } from "../types";
import { competitions as seedCompetitions } from "../data/competitions";
import { competitionsPageStats } from "../data/pageStats";
import { USE_MOCK, apiFetch } from "./config";

export const competitionService = {
  async list(): Promise<Competition[]> {
    if (USE_MOCK) return [...seedCompetitions];
    return apiFetch<Competition[]>("/competitions");
  },

  async getPageStats() {
    if (USE_MOCK) return { ...competitionsPageStats };
    return apiFetch("/competitions/stats");
  },

  getPageStatsSync() {
    return { ...competitionsPageStats };
  },
};
