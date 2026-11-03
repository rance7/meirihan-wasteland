import {afterEach,describe,it,expect,vi} from 'vitest';
import {loadWorkspace,saveWorkspace} from './api.js';

afterEach(()=>vi.unstubAllGlobals());
describe('database API',()=>{
  it('sends revision as a compare-and-swap precondition',async()=>{const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({revision:4,version:1})});vi.stubGlobal('fetch',fetch);await saveWorkspace({version:1,revision:3},3);const [url,options]=fetch.mock.calls[0];expect(url).toBe('/api/workspace');expect(options.headers['If-Match']).toBe('"3"');expect(JSON.parse(options.body).revision).toBe(3)});
  it('surfaces a conflict instead of treating it as saved',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:409,json:async()=>({error:'另一个页面已更新'})}));await expect(saveWorkspace({version:1},1)).rejects.toMatchObject({status:409,message:'另一个页面已更新'})});
  it('reports disconnected backend clearly',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('failed fetch')));await expect(loadWorkspace()).rejects.toMatchObject({status:0})});
});
