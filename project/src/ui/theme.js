// Brand tokens are shared with the existing appearance selector and drawing chrome.
export function deskTheme(brand){return {
 token:{colorPrimary:brand.primary,colorInfo:brand.primary,colorSuccess:'#23834b',colorWarning:'#ad6800',colorError:'#c93636',colorText:brand.ink,colorTextSecondary:brand.muted,colorBorder:brand.line,colorBgLayout:brand.bg,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif',fontSize:14,borderRadius:6,controlHeight:36},
 components:{Button:{primaryShadow:'none'},Card:{headerFontSize:17,bodyPadding:24},Menu:{itemHeight:44,itemMarginInline:0,itemBorderRadius:6,collapsedWidth:44,itemSelectedBg:brand.soft,itemSelectedColor:brand.primary},Table:{headerBg:brand.bg,cellPaddingBlock:16},Tag:{defaultBg:brand.soft,defaultColor:brand.primary}}
};}
