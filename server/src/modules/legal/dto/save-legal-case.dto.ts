import { Type } from 'class-transformer'
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'
import { LegalCaseStage } from '@prisma/client'

export class SaveLegalCaseDto {
  @IsNumber()
  @Type(() => Number)
  customerId: number

  @IsString()
  @IsNotEmpty()
  progressStatus: string

  @IsOptional()
  @IsString()
  caseResult?: string

  @IsOptional()
  @IsString()
  remark?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean

  @IsOptional()
  @IsBoolean()
  filingApproved?: boolean

  @IsOptional()
  @IsEnum(LegalCaseStage)
  stage?: LegalCaseStage

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  assistantUserId?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  filingSpecialistUserId?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  preTrialUserId?: number

  @IsOptional()
  @IsBoolean()
  assistantCollected?: boolean

  @IsOptional()
  @IsBoolean()
  assistantDocumented?: boolean

  @IsOptional()
  @IsBoolean()
  archiveNeeded?: boolean

  @IsOptional()
  @IsBoolean()
  archiveCompleted?: boolean

  @IsOptional()
  @IsBoolean()
  filingReviewed?: boolean

  @IsOptional()
  @IsBoolean()
  transferredToPreTrial?: boolean

  @IsOptional()
  @IsString()
  assistantCustomerSituationRemark?: string

  @IsOptional()
  @IsString()
  assistantFollowRemark?: string

  @IsOptional()
  @IsString()
  filingCustomerSituationRemark?: string

  @IsOptional()
  @IsString()
  filingFollowRemark?: string

  @IsOptional()
  @IsString()
  preTrialCustomerSituationRemark?: string

  @IsOptional()
  @IsString()
  preTrialFollowRemark?: string

  @IsOptional()
  @IsString()
  closeResult?: string
}
