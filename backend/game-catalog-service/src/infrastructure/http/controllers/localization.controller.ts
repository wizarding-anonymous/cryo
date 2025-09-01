import { Controller, Post, Body, Param, Get, Put } from '@nestjs/common';
import { LocalizationService } from '../../../application/services/localization.service';

class TranslationDto {
    languageCode: string;
    title: string;
    description?: string;
    shortDescription?: string;
}

@Controller('games/:gameId/localizations')
export class LocalizationController {
  constructor(private readonly localizationService: LocalizationService) {}

  @Post()
  addTranslation(@Param('gameId') gameId: string, @Body() translationDto: TranslationDto) {
    const { languageCode, ...data } = translationDto;
    return this.localizationService.addOrUpdateTranslation(gameId, languageCode, data);
  }

  @Get(':languageCode')
  getTranslation(@Param('gameId') gameId: string, @Param('languageCode') languageCode: string) {
    return this.localizationService.getTranslation(gameId, languageCode);
  }

  @Put(':languageCode')
    updateTranslation(
        @Param('gameId') gameId: string,
        @Param('languageCode') languageCode: string,
        @Body() translationDto: TranslationDto
    ) {
        const { ...data } = translationDto;
        return this.localizationService.addOrUpdateTranslation(gameId, languageCode, data);
    }
}
