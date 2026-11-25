import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DocTypeDto {
  DNI = 'DNI',
  PASAPORTE = 'PASAPORTE',
  CUIL = 'CUIL',
}

export enum PersonRoleDto {
  titular = 'titular',
  acompanante = 'acompanante',
}

export class PersonInputDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty({ enum: DocTypeDto, example: 'DNI' })
  @IsEnum(DocTypeDto)
  docType!: DocTypeDto;

  @ApiPropertyOptional({ example: '30123456', description: 'Obligatorio para acompañantes; el titular socio usa el documento de su cuenta.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  docNumber?: string;

  @ApiPropertyOptional({ enum: PersonRoleDto })
  @IsOptional()
  @IsEnum(PersonRoleDto)
  role?: PersonRoleDto;
}

export class EquipmentRequestDto {
  @ApiPropertyOptional({ example: 2, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  computers?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  projectors?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Pizarras desplazables' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  whiteboards?: number;
}

export class CreateReservationDto {
  @ApiProperty({ example: 'coworking' })
  @IsString()
  spaceCode!: string;

  @ApiProperty({ example: '2026-11-20' })
  @IsString()
  date!: string;

  @ApiProperty({ example: 'tarde' })
  @IsString()
  slotId!: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  partySize!: number;

  @ApiProperty({ type: [PersonInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PersonInputDto)
  people!: PersonInputDto[];

  @ApiPropertyOptional({ type: [String], description: 'Asientos elegidos manualmente' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatIds?: string[];

  @ApiPropertyOptional({ type: EquipmentRequestDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentRequestDto)
  equipment?: EquipmentRequestDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateReservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  partySize?: number;

  @ApiPropertyOptional({ type: [PersonInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PersonInputDto)
  people?: PersonInputDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatIds?: string[];

  @ApiPropertyOptional({ type: EquipmentRequestDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentRequestDto)
  equipment?: EquipmentRequestDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ description: 'Control optimista de versión' })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class CancelReservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
