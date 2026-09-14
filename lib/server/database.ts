import {Pool,types} from 'pg';
types.setTypeParser(20,Number);
let pool:Pool|undefined;
function connection(){if(!process.env.DATABASE_URL)throw new Error('请先配置 Supabase 数据库。');return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:10000})}
// Keep the existing parameterized task queries while moving SQLite data to Postgres.
export function postgresQuery(sql:string){let index=0;const ignore=/^INSERT OR IGNORE /i.test(sql);sql=sql.replace(/^INSERT OR IGNORE /i,'INSERT ');sql=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?|\b(?:preserveRules|thumbnail|versionCount)\b/g,part=>part==='?'?`$${++index}`:part[0]==="'"||part[0]==='"'?part:`"${part}"`);return sql+(ignore?' ON CONFLICT DO NOTHING':'')}
class Statement{
 values:unknown[]=[];
 constructor(readonly sql:string){}
 bind(...values:unknown[]){this.values=values;return this}
 async result(){return connection().query(postgresQuery(this.sql),this.values)}
 async first<T=Record<string,unknown>>(){return (await this.result()).rows[0] as T|null??null}
 async all<T=Record<string,any>>(){return {results:(await this.result()).rows as T[]}}
 async run(){return {meta:{changes:(await this.result()).rowCount||0}}}
}
export function database(){return {prepare:(sql:string)=>new Statement(sql),async batch(statements:Statement[]){const client=await connection().connect();try{await client.query('BEGIN');const results=[];for(const s of statements){const r=await client.query(postgresQuery(s.sql),s.values);results.push({meta:{changes:r.rowCount||0}})}await client.query('COMMIT');return results}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}}}
