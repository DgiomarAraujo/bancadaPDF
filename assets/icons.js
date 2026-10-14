(function(G){
var IC={
 merge:'<path d="M5 3v5a5 5 0 0 0 5 5h4a5 5 0 0 1 5 5v1"/><path d="M19 3v5a5 5 0 0 1-3 4.6"/><path d="m16.5 18.5 2.5 2.5 2.5-2.5"/>',
 split:'<path d="M12 3v7"/><path d="M12 10 5 21M12 10l7 11"/><path d="m8.5 6.5 3.5-3.5 3.5 3.5"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
 rotate:'<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
 grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
 hash:'<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/>',
 img:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 3 3-3 4 4"/>',
 doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h5"/>',
 compress:'<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/>',
 download:'<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
 back:'<path d="m15 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>',
 home:'<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
 info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
 shield:'<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',up:'<path d="m6 14 6-6 6 6"/>',down:'<path d="m6 10 6 6 6-6"/>',
 file:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
 install:'<path d="M12 4v10m0 0-4-4m4 4 4-4"/><rect x="4" y="16" width="16" height="4" rx="1.5"/>'
};
var f=function(n){return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+IC[n]+'</svg>'};
G.BancadaIcons={IC:IC,ic:f};
if(typeof module!=='undefined'&&module.exports)module.exports=G.BancadaIcons;
})(typeof globalThis!=='undefined'?globalThis:window);
