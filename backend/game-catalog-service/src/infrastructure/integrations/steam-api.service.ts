import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SteamApiService {
  private readonly logger = new Logger(SteamApiService.name);

  async getGameDetails(steamAppId: string): Promise<any> {
    this.logger.log(`Fetching mock details for Steam App ID: ${steamAppId}`);

    // Return realistic mock data
    return {
      name: `Mock Steam Game ${steamAppId}`,
      short_description: 'This is a mock description from the mock Steam API.',
      header_image: `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/header.jpg`,
      release_date: {
        coming_soon: false,
        date: '2023-10-26',
      },
      pc_requirements: {
        minimum: '<strong>Minimum:</strong><br><ul class=\"bb_ul\"><li><strong>OS:</strong> Windows 10</li></ul>',
        recommended: '<strong>Recommended:</strong><br><ul class=\"bb_ul\"><li><strong>OS:</strong> Windows 11</li></ul>',
      },
      developers: ['Mock Developer'],
      publishers: ['Mock Publisher'],
    };
  }
}
