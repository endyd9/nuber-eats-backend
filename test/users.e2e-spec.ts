import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { DataSource, Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Verification } from 'src/users/entities/verification.entity';

jest.mock('got', () => {
  return {
    post: jest.fn(),
  };
});

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  EMAIL: 'test@email.com',
  PASSWORD: '12345',
};

describe('AppController (e2e)', () => {
  let app;
  let userRepository: Repository<User>;
  let jwtToken: string;
  let verifycationsRepository: Repository<Verification>;

  const baseTest = () => request(app.getHttpServer()).post(GRAPHQL_ENDPOINT);
  const publicTest = (query: string) => baseTest().send({ query });
  const privateTest = (query: string) =>
    baseTest().set('x-jwt', jwtToken).send({ query });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    verifycationsRepository = module.get<Repository<Verification>>(
      getRepositoryToken(Verification),
    );
    await app.init();
  });

  afterAll(async () => {
    const dbSource: DataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const connecttion: DataSource = await dbSource.initialize();
    await connecttion.dropDatabase();
    await connecttion.destroy();
    await app.close();
  });

  describe('createAccount', () => {
    it('should create account', () => {
      return publicTest(
        `
        mutation{
          createAccount(input:{
            email: "${testUser.EMAIL}",
            password:"${testUser.PASSWORD}",
            role:Client
          }){
            ok
            error
          }
        }
        `,
      )
        .expect(200)
        .expect((res) => {
          expect(res.body.data.createAccount.ok).toBe(true);
          expect(res.body.data.createAccount.error).toBe(null);
        });
    });

    it('should fail if account already exists', () => {
      return publicTest(
        `
          mutation{
            createAccount(input:{
              email: "${testUser.EMAIL}",
              password:"${testUser.PASSWORD}",
              role:Client
            }){
              ok
              error
            }
          }
        `,
      )
        .expect(200)
        .expect((res) => {
          expect(res.body.data.createAccount.ok).toBe(false);
          expect(res.body.data.createAccount.error).toEqual(
            '이미 가입된 이메일 입니다.',
          );
        });
    });
  });

  describe('Login', () => {
    it('should login whit correct credentials', () => {
      return publicTest(
        `
        mutation{
          Login(input:{
            email:"${testUser.EMAIL}"
            password:"${testUser.PASSWORD}"
          }){
            ok
            error
            token
          }
        }`,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { Login },
            },
          } = res;
          expect(Login.ok).toBe(true);
          expect(Login.error).toBe(null);
          expect(Login.token).toEqual(expect.any(String));
          jwtToken = Login.token;
        });
    });

    it('should fail login whit worng credentials', () => {
      return publicTest(`
      mutation{
        Login(input:{
          email:"${testUser.EMAIL}"
          password:"11111"
        }){
          ok
          error
          token
        }
      }`)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { Login },
            },
          } = res;
          expect(Login.ok).toBe(false);
          expect(Login.error).toBe('비밀번호가 일치하지 않습니다');
          expect(Login.token).toBe(null);
        });
    });
  });

  describe('userProfile', () => {
    let userId: number;
    beforeAll(async () => {
      const [user] = await userRepository.find();
      userId = user.id;
    });
    it('should find a user', () => {
      return privateTest(`
        
        {
          userProfile(userId:${userId}){
            ok
            error
            user{
              id
            }
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                userProfile: {
                  ok,
                  error,
                  user: { id },
                },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
          expect(id).toBe(userId);
        });
    });

    it('should not found user', () => {
      return privateTest(`
        
        {
          userProfile(userId:3){
            ok
            error
            user{
              id
            }
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                userProfile: { ok, error, user },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(error).toBe('유저 정보를 찾을 수 없습니다.');
          expect(user).toBe(null);
        });
    });
  });

  describe('me', () => {
    it('should find my profile', () => {
      return privateTest(`
        {
          me{
            email
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                me: { email },
              },
            },
          } = res;
          expect(email).toBe(testUser.EMAIL);
        });
    });

    it('should not allow logged out user', () => {
      return publicTest(`
        {
          me{
            email
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: { errors },
          } = res;
          const [error] = errors;
          expect(error.message).toBe('Forbidden resource');
        });
    });
  });

  describe('editProfile', () => {
    const NEW_EMAIL = 'test2@email.com';
    const NEW_PASS = '11111';
    it('should change email', () => {
      return privateTest(`
          mutation{
            editProfile(input:{
              email:"${NEW_EMAIL}"
            }){
              ok
              error
            }
          }`)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                editProfile: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
        });
    });

    it('should have a new email', () => {
      return privateTest(`
        {
          me{
            email
          }
        }
      `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                me: { email },
              },
            },
          } = res;
          expect(email).toBe(NEW_EMAIL);
        });
    });

    it('should change password', () => {
      return privateTest(`
          mutation{
            editProfile(input:{
              email:"test2@email.com"
            }){
              ok
              error
            }
          }`)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                editProfile: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
        });
    });
  });

  describe('verifyEmail', () => {
    let verficationCode: string;
    beforeAll(async () => {
      const [verification] = await verifycationsRepository.find();
      verficationCode = verification.code;
    });

    it('should verify email', () => {
      return privateTest(
        `
          mutation{
            verifyEmail(input:{
              code:"${verficationCode}"
            }){
              ok
              error
            }
          }
          `,
      )
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
        });
    });

    it('should fail on wrong verification code', () => {
      return privateTest(`
          mutation{
            verifyEmail(input:{
              code:"xxxx"
            }){
              ok
              error
            }
          }
          `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(error).toBe('인증번호를 다시 확인 해 주세요');
        });
    });
  });
});
