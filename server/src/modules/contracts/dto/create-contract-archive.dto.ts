import { Type } from 'class-transformer'
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export enum ContractSalesStageDto {
  FIRST = 'FIRST',
  SECOND = 'SECOND',
  THIRD = 'THIRD',
}

export class CreateContractArchiveDto {
  @IsString()
  @IsNotEmpty()
  contractNo: string

  @IsNumber()
  @Type(() => Number)
  customerId: number

  @IsEnum(ContractSalesStageDto)
  salesStage: ContractSalesStageDto

  @IsNumber()
  @Type(() => Number)
  relatedOrderId: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number

  @IsDateString()
  signDate: string

  @IsNumber()
  @Type(() => Number)
  contractSpecialistId: number

  @IsOptional()
  @IsString()
  remark?: string
}
