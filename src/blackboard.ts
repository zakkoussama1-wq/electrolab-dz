/** Align a chain of equalities at the outer mathematical level only.
 * Fractions, boxes, data links and existing environments are left intact. */
export function blackboardTex(tex:string) {
 if(/\\begin\{|\\boxed\{|(?<!\\),|\\q?quad/.test(tex)) return tex;
 let depth=0;const positions:number[]=[];
 for(let i=0;i<tex.length;i++) {if(tex[i]==='{'&&tex[i-1]!=='\\')depth++;else if(tex[i]==='}'&&tex[i-1]!=='\\')depth--;else if(tex[i]==='='&&depth===0)positions.push(i);}
 if(!positions.length) return tex;
 let out=tex.slice(0,positions[0]);
 positions.forEach((p,i)=>{out+=(i?'\\\\':'')+'&='+tex.slice(p+1,positions[i+1]??tex.length);});
 return `\\begin{aligned}${out}\\end{aligned}`;
}
