import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'socio@coworking.gob.ar' })
  @IsEmail({}, { message: 'Ingresá un email válido.' })
  email!: string;

  @ApiProperty({ example: 'Socio1234!' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  @MaxLength(120)
  password!: string;
}
