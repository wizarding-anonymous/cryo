import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import {
  PaginationQueryDto,
  UserFilterDto,
  CursorUtils,
  CursorData,
} from '../dto/pagination.dto';
import { PaginatedResponseDto, PaginationMeta } from '../dto/api-response.dto';

@Injectable()
export class PaginationService {
  /**
   * Применяет cursor-based пагинацию к query builder
   */
  async applyCursorPagination<T>(
    queryBuilder: SelectQueryBuilder<T>,
    paginationDto: PaginationQueryDto,
    alias: string = 'entity',
  ): Promise<{
    items: T[];
    pagination: PaginationMeta;
  }> {
    const {
      cursor,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = paginationDto;

    // Применяем сортировку
    queryBuilder.orderBy(
      `${alias}.${sortBy}`,
      sortOrder.toUpperCase() as 'ASC' | 'DESC',
    );

    // Добавляем дополнительную сортировку по ID для стабильности
    if (sortBy !== 'id') {
      queryBuilder.addOrderBy(
        `${alias}.id`,
        sortOrder.toUpperCase() as 'ASC' | 'DESC',
      );
    }

    // Применяем cursor если он есть
    if (cursor) {
      const cursorData = CursorUtils.decodeCursor(cursor);
      if (cursorData) {
        this.applyCursorCondition(
          queryBuilder,
          cursorData,
          sortBy,
          sortOrder,
          alias,
        );
      }
    }

    // Получаем на один элемент больше для определения hasNext
    const items = await queryBuilder.limit(limit + 1).getMany();

    const hasNext = items.length > limit;
    if (hasNext) {
      items.pop(); // Удаляем лишний элемент
    }

    // Создаем курсоры для следующей и предыдущей страниц
    const nextCursor =
      hasNext && items.length > 0
        ? CursorUtils.createUserCursor(items[items.length - 1], sortBy)
        : null;

    // Для предыдущего курсора нужно знать общее количество или использовать обратную логику
    const previousCursor = cursor
      ? this.createPreviousCursor(items, sortBy)
      : null;

    const pagination = new PaginationMeta(
      0, // total будет вычислен отдельно если нужен
      1, // page не используется в cursor-based пагинации
      limit,
      hasNext,
      !!cursor, // hasPrevious = true если есть cursor
      nextCursor,
      previousCursor,
    );

    return {
      items,
      pagination,
    };
  }

  /**
   * Применяет offset-based пагинацию к query builder
   */
  async applyOffsetPagination<T>(
    queryBuilder: SelectQueryBuilder<T>,
    paginationDto: PaginationQueryDto,
    alias: string = 'entity',
  ): Promise<{
    items: T[];
    pagination: PaginationMeta;
  }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = paginationDto;

    // Применяем сортировку
    queryBuilder.orderBy(
      `${alias}.${sortBy}`,
      sortOrder.toUpperCase() as 'ASC' | 'DESC',
    );

    // Добавляем дополнительную сортировку по ID для стабильности
    if (sortBy !== 'id') {
      queryBuilder.addOrderBy(
        `${alias}.id`,
        sortOrder.toUpperCase() as 'ASC' | 'DESC',
      );
    }

    // Получаем общее количество записей
    const total = await queryBuilder.getCount();

    // Применяем offset и limit
    const offset = (page - 1) * limit;
    const items = await queryBuilder.skip(offset).take(limit).getMany();

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    const pagination = new PaginationMeta(
      total,
      page,
      limit,
      hasNext,
      hasPrevious,
    );

    return {
      items,
      pagination,
    };
  }

  /**
   * Применяет фильтры пользователей к query builder
   */
  applyUserFilters(
    queryBuilder: SelectQueryBuilder<any>,
    filterDto: UserFilterDto,
    alias: string = 'user',
  ): void {
    const {
      name,
      email,
      isActive,
      createdFrom,
      createdTo,
      lastLoginFrom,
      lastLoginTo,
      language,
      timezone,
      includeDeleted,
    } = filterDto;

    // Фильтр по имени (частичное совпадение)
    if (name) {
      queryBuilder.andWhere(`${alias}.name ILIKE :name`, { name: `%${name}%` });
    }

    // Фильтр по email (частичное совпадение)
    if (email) {
      queryBuilder.andWhere(`${alias}.email ILIKE :email`, {
        email: `%${email}%`,
      });
    }

    // Фильтр по активности
    if (isActive !== undefined) {
      queryBuilder.andWhere(`${alias}.isActive = :isActive`, { isActive });
    }

    // Фильтр по дате создания
    if (createdFrom) {
      queryBuilder.andWhere(`${alias}.createdAt >= :createdFrom`, {
        createdFrom,
      });
    }
    if (createdTo) {
      queryBuilder.andWhere(`${alias}.createdAt <= :createdTo`, { createdTo });
    }

    // Фильтр по дате последнего входа
    if (lastLoginFrom) {
      queryBuilder.andWhere(`${alias}.lastLoginAt >= :lastLoginFrom`, {
        lastLoginFrom,
      });
    }
    if (lastLoginTo) {
      queryBuilder.andWhere(`${alias}.lastLoginAt <= :lastLoginTo`, {
        lastLoginTo,
      });
    }

    // Фильтр по языку в preferences
    if (language) {
      queryBuilder.andWhere(`${alias}.preferences->>'language' = :language`, {
        language,
      });
    }

    // Фильтр по timezone в preferences
    if (timezone) {
      queryBuilder.andWhere(`${alias}.preferences->>'timezone' = :timezone`, {
        timezone,
      });
    }

    // Исключение удаленных пользователей (по умолчанию)
    if (!includeDeleted) {
      queryBuilder.andWhere(`${alias}.deletedAt IS NULL`);
    }
  }

  /**
   * Применяет условие курсора к query builder
   */
  private applyCursorCondition(
    queryBuilder: SelectQueryBuilder<any>,
    cursorData: CursorData,
    sortBy: string,
    sortOrder: string,
    alias: string,
  ): void {
    const operator = sortOrder === 'desc' ? '<' : '>';
    const cursorValue = cursorData[sortBy] || cursorData.createdAt;

    if (
      sortBy === 'createdAt' ||
      sortBy === 'updatedAt' ||
      sortBy === 'lastLoginAt'
    ) {
      // Для дат
      queryBuilder.andWhere(`${alias}.${sortBy} ${operator} :cursorValue`, {
        cursorValue: new Date(cursorValue as string | number | Date),
      });
    } else if (sortBy === 'name' || sortBy === 'email') {
      // Для строк
      queryBuilder.andWhere(`${alias}.${sortBy} ${operator} :cursorValue`, {
        cursorValue: cursorValue as string,
      });
    } else {
      // Для других типов
      queryBuilder.andWhere(`${alias}.${sortBy} ${operator} :cursorValue`, {
        cursorValue: cursorValue as string | number,
      });
    }

    // Добавляем условие по ID для стабильности при одинаковых значениях sortBy
    queryBuilder.andWhere(`${alias}.id ${operator} :cursorId`, {
      cursorId: cursorData.id,
    });
  }

  /**
   * Создает курсор для предыдущей страницы
   */
  private createPreviousCursor(
    items: Record<string, any>[],
    sortBy: string,
  ): string | null {
    if (items.length === 0) return null;

    // Для предыдущего курсора берем первый элемент
    return CursorUtils.createUserCursor(items[0], sortBy);
  }

  /**
   * Создает стандартный пагинированный ответ
   */
  createPaginatedResponse<T>(
    items: T[],
    pagination: PaginationMeta,
  ): PaginatedResponseDto<T> {
    return new PaginatedResponseDto(items, pagination);
  }
}
