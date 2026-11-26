"use strict";
/* Mode map, seeded plate and downhill sand motion adapted from Prízrak's
   The Chladni Table, source blob 6ff42eb07a3142482444ce96b29b17ad1e9db2b2.
   The lab uses fixed starting grains, a cached field and a measured scan line. */
globalThis.ChladniPlate = (() => {
  const grainCount = 3000, steps = 130, grid = 144, stride = grid + 1, epsilon = 0.0032;
  function rngFrom(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function modeFor(dial) {
    const f = dial / 1000;
    return {n:0.8 + 9.4*f, m:0.8 + 9.4*f*0.72 + 0.6};
  }
  function makeField(dial, rng) {
    const warpX = .06 + rng()*.12, warpY = .06 + rng()*.12;
    const phaseX = rng()*Math.PI*2, phaseY = rng()*Math.PI*2;
    const a = .55 + rng()*.4, b = 1-a+.35, swirl=(rng()*2-1)*.10;
    const cs=Math.cos(swirl), sn=Math.sin(swirl), mode=modeFor(dial);
    const n=Math.PI*mode.n, m=Math.PI*mode.m;
    return function(px,py) {
      const wx=px+warpX*Math.sin(py*Math.PI*2+phaseX)*.06-.5;
      const wy=py+warpY*Math.sin(px*Math.PI*2+phaseY)*.06-.5;
      const x=.5+wx*cs-wy*sn, y=.5+wx*sn+wy*cs;
      return a*Math.cos(n*x)*Math.cos(m*y) + b*Math.cos(m*x)*Math.cos(n*y);
    };
  }
  function guideCrossings(field) {
    // Count sign changes along the horizontal midline; refine each location.
    const divisions=1024, roots=[];
    let prev=field(0,.5);
    for(let i=1;i<=divisions;i++){
      const value=field(i/divisions,.5);
      if((prev<0)!==(value<0)){
        let left=(i-1)/divisions, right=i/divisions;
        for(let k=0;k<12;k++){
          const middle=(left+right)/2;
          if((field(middle,.5)<0)===(prev<0))left=middle;else right=middle;
        }
        roots.push((left+right)/2);
      }
      prev=value;
    }
    return roots;
  }
  function prepare(seed,dial) {
    const rng=rngFrom(seed), field=makeField(dial,rng);
    const u=new Float32Array(stride*stride), gx=new Float32Array(u.length), gy=new Float32Array(u.length);
    for(let j=0;j<=grid;j++)for(let i=0;i<=grid;i++){
      const k=j*stride+i, x=i/grid,y=j/grid;
      u[k]=field(x,y);
      gx[k]=(Math.abs(field(x+epsilon,y))-Math.abs(field(x-epsilon,y)))/(2*epsilon);
      gy[k]=(Math.abs(field(x,y+epsilon))-Math.abs(field(x,y-epsilon)))/(2*epsilon);
    }
    const xs=new Float32Array(grainCount), ys=new Float32Array(grainCount), sizes=new Float32Array(grainCount);
    for(let i=0;i<grainCount;i++){xs[i]=rng();ys[i]=rng();sizes[i]=.55+rng()*.9;}
    const roots=guideCrossings(field);
    let energy=.7, frame=0;
    const target=.62+(dial/1000)*.34;
    function advance(amount) {
      const end=Math.min(steps,frame+amount);
      for(;frame<end;frame++){
        energy+=(target-energy)*.04;
        const settle=.020+.030*(1-energy*.4), shakeBase=.009*(.35+energy);
        for(let i=0;i<grainCount;i++){
          let x=xs[i], y=ys[i];
          const ix=Math.max(0,Math.min(grid-.0001,x*grid)), iy=Math.max(0,Math.min(grid-.0001,y*grid));
          const col=Math.floor(ix), row=Math.floor(iy), k=row*stride+col, fx=ix-col, fy=iy-row;
          const p=(1-fx)*(1-fy),q=fx*(1-fy),r=(1-fx)*fy,s=fx*fy;
          const amp=Math.abs(p*u[k]+q*u[k+1]+r*u[k+stride]+s*u[k+stride+1]);
          const dx=p*gx[k]+q*gx[k+1]+r*gx[k+stride]+s*gx[k+stride+1];
          const dy=p*gy[k]+q*gy[k+1]+r*gy[k+stride]+s*gy[k+stride+1];
          const length=Math.sqrt(dx*dx+dy*dy+1e-6), movement=settle*amp*Math.sqrt(amp)/length;
          x-=dx*movement; y-=dy*movement;
          const shake=shakeBase*amp*amp;
          if(shake>.00002){x+=(rng()*2-1)*shake;y+=(rng()*2-1)*shake;}
          if(x<.002)x=.002+(.002-x)*.5;else if(x>.998)x=.998-(x-.998)*.5;
          if(y<.002)y=.002+(.002-y)*.5;else if(y>.998)y=.998-(y-.998)*.5;
          xs[i]=x;ys[i]=y;
        }
      }
    }
    function quiet() {
      let n=0;
      for(let i=0;i<grainCount;i++)if(Math.abs(field(xs[i],ys[i]))<.08)n++;
      return n;
    }
    function draw(canvas,showRoots) {
      const ctx=canvas.getContext("2d");
      const w=canvas.width, inset=w*.037, length=w-2*inset;
      ctx.fillStyle="#171e22";ctx.fillRect(0,0,w,w);
      ctx.lineWidth=1;ctx.strokeStyle="#334044";
      ctx.strokeRect(inset-.5,inset-.5,length+1,length+1);
      const scale=w/500;
      ctx.fillStyle="#f7e6bd";
      for(let i=0;i<grainCount;i++){
        const amp=Math.abs(field(xs[i],ys[i]));
        const settled=1-Math.min(1,amp*3.2);
        ctx.globalAlpha=.25+settled*.64;
        const size=(.7+sizes[i]*.95)*scale;
        ctx.fillRect(inset+xs[i]*length,inset+ys[i]*length,size,size);
      }
      ctx.globalAlpha=1;const mid=w/2;
      ctx.strokeStyle="#78cccd";ctx.lineWidth=1.45*scale;ctx.setLineDash([6*scale,5*scale]);
      ctx.beginPath();ctx.moveTo(inset,mid);ctx.lineTo(w-inset,mid);ctx.stroke();ctx.setLineDash([]);
      if(showRoots){
        for(const root of roots){
          const x=inset+root*length;
          ctx.beginPath();ctx.arc(x,mid,4.5*scale,0,2*Math.PI);
          ctx.fillStyle="#53d7db";ctx.fill();ctx.strokeStyle="#102b31";ctx.lineWidth=1.65*scale;ctx.stroke();
        }
      }
    }
    return {dial,seed,roots,mode:modeFor(dial),field,advance,quiet,draw, get frame(){return frame;}};
  }
  return Object.freeze({prepare,modeFor,makeField,rngFrom,guideCrossings,grainCount,steps});
})();
