import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { LegalCaseStage } from '@prisma/client'

export class QueryLegalCasesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number

  @IsOptional()
  @IsEnum(LegalCaseStage)
  stage?: LegalCaseStage
}
