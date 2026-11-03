export class APIError extends Error {
  constructor(message,status) {super(message);this.status=status;}
}

async function request(options={}) {
  let response;
  try {response=await fetch('/api/workspace',{...options,signal:options.signal ?? AbortSignal.timeout(15000)});}
  catch(error) {if(error.name==='AbortError')throw error;throw new APIError('连接后端失败，请确认 Go 服务和 MongoDB 已启动。',0);}
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new APIError(data?.error||`请求失败 (${response.status})`,response.status);
  if(!data||typeof data.revision!=='number')throw new APIError('后端返回的数据格式不正确。',502);
  return data;
}

export const loadWorkspace=signal=>request({signal});
export const saveWorkspace=(workspace,revision)=>request({
  method:'PUT',headers:{'Content-Type':'application/json','If-Match':`"${revision}"`},
  body:JSON.stringify({...workspace,revision})
});
