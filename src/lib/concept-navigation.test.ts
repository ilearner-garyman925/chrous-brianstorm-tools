import {expect,it} from "vitest";
import {conceptForResponse} from "./concept-detail";
it("uses explicit response membership before matching words",()=>{
 const target={text:"保留自己的聲音",themeId:"voice",responseIds:["r1"]};
 expect(conceptForResponse({id:"r1",text:"AI"},[{text:"AI",themeId:null},target],[])).toBe(target);
});
it("does not navigate to an unrelated bubble from a theme fallback",()=>{
 expect(conceptForResponse({id:"r1",text:"unrelated"},[{text:"access",themeId:"theme"}],[{id:"theme",label:"Theme",summary:"",responseIds:["r1"]}])).toBeNull();
});
it("supports legacy direct wording but respects explicit membership",()=>{
 const response={id:"r1",text:"Check sources"};
 const legacy={text:"Check sources",themeId:null};
 expect(conceptForResponse(response,[legacy],[])).toBe(legacy);
 expect(conceptForResponse(response,[{...legacy,responseIds:["other"]}],[])).toBeNull();
});
