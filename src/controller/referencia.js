2fbd5682369ca0726721049423e6362be9402624



unit tiny.api;

interface

uses
Classes,
   DB, DBClient,
   IniFiles,
   System.Net.HttpClient,
   System.SysUtils,
   System.StrUtils,
   System.Generics.Collections,
   System.DateUtils,
   System.JSON,


   XSuperObject,
   produto.util,

   co.biblioteca,
   co.json.utils,
   tiny.http;





{      Centralizar tudo que for relacionado a api
      Ideia aqui é apenas processar a informacao  comunicando
      direto com a api da Tiny

      nao tem acesso ao banco local do cliente
      tudo que precisa tem que estar dentro da req_json
}

//nao criar class function para ficar controlando quando destruir
//porque sera usado do lado do servidor , então cada requisicao
//tera que destruir tudo que foi criado aqui


type
TEstoque = class
   idProduto: String;
estoque: Currency;
preco: Currency;
end;


TCredentialAcess = class(TIniFile)
public
id_store: integer;
client_id: string;
client_secret: string;
acess_token: string;
auth_code: string;
data_token: TDateTime;
url: string;
class function New(pJSON: string): TCredentialAcess;
end;


ITinyApi = interface
['{1955BA7A-7D09-4D8F-9695-EEA8EC577F98}']
function GetWstore: TJSONObject;
      procedure SetJSONBody(pValue: string);

// Utils
function ExecuteHTTP(RestUrl, methodo, params: string): string;

function ParseToCategoria(pJson: string): string;
function ParseToProduto(pJson: string): string;
function ParseToParams(ParamsName, ParamsValue: string): string;


//
function CategoriaPost(pJson: string): string;
function CategoriaPut(pJson: string): string;

function ProdutoPost(pJson: string): string;
function ProdutoPut(pJson: string): string;
function ProdutoGet(pIdProduto: string): string;
function ProdutoPutImagens(pJson: string): string;

function ProdutoEstoquePut(pJson: string): string;
function ProdutoEstoqueSearch(pIdProduto: string): string;

function ProdutoPrecoPut(pJson: string): string;

function ProdutoImagemPost(pJson: string): string;
function ProdutoImagemPut(pJson: string): string;

//Pedidos
function PedidoSearchGet(pJson: string): string;
function PedidoGet(pId: string): string;

end;


type
TTinyApi = class(TInterfacedObject, ITinyApi)
    strict private

tiny_acess_token: string;

FStore: TJSONObject; //destruo pelo Destroy ...
FReq_JSON: string;
FId_store: string;
      procedure LoadParams;
      procedure SetIdStore(const value: string);
function GetIdStore: string;


public
     destructor Destroy; override;
class function New(pReq_json: string): ITinyApi;

{ Interface }
function GetWstore: TJSONObject;
      procedure SetJSONBody(pValue: string);

// Utils
function ExecuteHTTP(RestUrl, methodo, params: string): string;
function ParseToCategoria(pJson: string): string;
function ParseToProduto(pJson: string): string;
function ParseToParams(ParamsName, ParamsValue: string): string;



//Loja
function CategoriaPost(pJson: string): string;
function CategoriaPut(pJson: string): string;

function ProdutoPost(pJson: string): string;
function ProdutoPut(pJson: string): string;
function ProdutoGet(pIdProduto: string): string;
function ProdutoPutImagens(pJson: string): string;


function ProdutoEstoquePut(pJson: string): string;
function ProdutoEstoqueSearch(pIdProduto: string): string;


function ProdutoPrecoPut(pJson: string): string;


function ProdutoImagemPost(pJson: string): string;
function ProdutoImagemPut(pJson: string): string;

//Pedidos
function PedidoSearchGet(pJson: string): string;
function PedidoGet(pId: string): string;


function OnlyNumber(AValue: string): string;

end;




implementation

{ TCredentialAcess }

class function TCredentialAcess.New(pJSON: string): TCredentialAcess;
var
   credentialApp: string;
LStore: TJSONObject;
LId_store: Integer;
LDirectory: string;
begin
LStore:= ParseToJSON(pJSON);

if not LStore.TryGetValue('id_store', LId_Store) then
Exit;
LDirectory:= ExtractFilePath(GetModuleName(HInstance)) + '\store';
if not DirectoryExists(LDirectory) then
ForceDirectories(LDirectory);

credentialApp:= LDirectory + Format('\%s.ini', [LId_store.toString]);
Result:= TCredentialAcess.Create(credentialApp);

with Result do begin
    id_store       := LId_store;
client_id:= ReadString('CREDENTIAL', 'client_id', '');
client_secret:= ReadString('CREDENTIAL', 'client_secret', '');
acess_token:= ReadString('CREDENTIAL', 'acess_token', '');
auth_code:= ReadString('CREDENTIAL', 'auth_code', '');
data_token:= ReadDateTime('CREDENTIAL', 'data_token', Now - 7);
url:= ReadString('CREDENTIAL', 'url', '');

if client_id = '' then
begin
WriteString('CREDENTIAL', 'client_id', lstore.GetValue < string > ('client_id'));
WriteString('CREDENTIAL', 'client_secret', lstore.GetValue < string > ('client_secret'));
WriteString('CREDENTIAL', 'acess_token', lstore.GetValue < string > ('acess_token'));
WriteString('CREDENTIAL', 'auth_code', lstore.GetValue < string > ('auth_code'));
WriteDateTime('CREDENTIAL', 'data_token', Now - 7);
WriteString('CREDENTIAL', 'url', lstore.GetValue < string > ('dropbox'));

client_id:= ReadString('CREDENTIAL', 'client_id', '');
client_secret:= ReadString('CREDENTIAL', 'client_secret', '');
acess_token:= ReadString('CREDENTIAL', 'acess_token', '');
auth_code:= ReadString('CREDENTIAL', 'auth_code', '');
data_token:= ReadDateTime('CREDENTIAL', 'data_token', Now - 7);
url:= ReadString('CREDENTIAL', 'url', '');
end;

end;

FreeAndNil(LStore);
end;

{ TTinyApi }

function toCurrStr(pValue: Currency): string;
begin
Result:= CurrToStr(pValue);
Result:= StringReplace(Result, ',', '.', [rfReplaceAll]);
end;


function TTinyApi.CategoriaPost(pJson: string): string;
begin
Result:= ExecuteHTTP('categoria', 'POST', pJson);
end;

function TTinyApi.CategoriaPut(pJson: string): string;
var
   jBody: TJSONObject;
jSend: TJSONObject;
LId: Integer;
lnome: string;
lcategoria_pai: string;
begin
{Ja vem parseada da categoria  apenas pegar os valores que desejo atualizar e pronto }
jSend:= ParseToJSON('');
jBody:= ParseToJSON(pJson);
if jBody.TryGetValue('id', LId) then
begin
jSend.AddPair('id', TJSONNumber.Create(LId))
end;

if not jBody.TryGetValue('nome', lnome) then
lnome:= '';
if jBody.Values['categoria_pai'].Value = 'null' then
begin
lcategoria_pai:= '';
  end else
begin
if not jBody.TryGetValue('categoria_pai', lcategoria_pai) then
lcategoria_pai:= '';
end;
jSend.AddPair('nome', lnome);
if lcategoria_pai = '' then
jSend.AddPair('categoria_pai', TJSONNull.Create)
  else
jSend.AddPair('categoria_pai', lcategoria_pai);

Result:= ExecuteHTTP(Format('categoria/%s', [LId.ToString]), 'PUT', jSend.ToJSON);
jBody.DisposeOf;
jSend.DisposeOf;
end;

destructor TTinyApi.Destroy;
begin
tiny_acess_token:= '';
FReq_JSON:= '';

if Assigned(FStore) then
begin
FStore.Owned := True;
FreeAndNil(FStore);
end;
inherited;
end;

procedure TTinyApi.LoadParams;
begin

if tiny_acess_token = '' then
begin

with TCredentialAcess.New(GetWstore.ToJSON) do
   begin
      tiny_acess_token := acess_token;
DisposeOf;
end;
end;
end;

function TTinyApi.ExecuteHTTP(RestUrl, methodo, params: string): string;
begin
Result:= TTinyHTTP.Execute(RestUrl, methodo, params);
end;

function TTinyApi.GetIdStore: string;
begin
Result:= FId_store;
end;

function TTinyApi.GetWstore: TJSONObject;
var
   jo: TJSONObject;
LJSON: string;
LIdstore: Integer;
Lixo: TJSONObject;
begin

if not Assigned(FStore) then
begin
jo:= ParseToJSON(FReq_JSON);
Lixo:= jo.GetValue < TJSONObject > ('store');
LJson:= Lixo.toJSON;
FStore:= ParseToJSON(LJson);
if FStore.TryGetValue('id_store', LIdstore) then
SetIdStore(LIdstore.ToString);
jo.Owned := True;
FreeAndNil(jo);
end;
Result:= FStore;
end;

class function TTinyApi.New(pReq_json: string): ITinyApi;
begin
Result:= TTinyApi.Create;
Result.SetJSONBody(pReq_json);
end;

function TTinyApi.OnlyNumber(AValue: string): string;
var
   I: integer;
begin
Result:= '';
for I := 1 to length(AValue) do
   if AValue[i] in ['0'.. '9'] then
      Result := Result + AValue[i];
end;

function TTinyApi.ParseToCategoria(pJson: string): string;
var
   jCat: TJSONObject;
jReq: TJSONObject;
jBody: TJSONObject;
LValue: string;
LValueInt: Integer;
begin
jReq:= ParseToJSON(pJson);
jCat:= jReq.GetValue < TJSONObject > ('categoria');

jBody:= TJSONObject.Create;
{
    Tenho que enviar um Json nesse formato:
   "id": 98484,
      "id_externo": null,
         "nome": "Caneca",
            "descricao": "Canecas.",
               "categoria_pai": null / api / v1 / categoria / 1
}
if not jCat.TryGetValue('id', lvalueInt) then
lvalueInt:= 0;

if lvalueInt > 0 then
jBody.AddPair('id', TJSONNumber.Create(lvalueInt));

jBody.AddPair('id_externo', TJSONNull.Create);
if not jCat.TryGetValue('descricao', lvalue) then
lValue:= '';
jBody.AddPair('nome', TJSONString.Create(lvalue));
jBody.AddPair('descricao', TJSONString.Create(lvalue));

//esse campo tem que ser calculado no momento de envirar para cara
if not jCat.TryGetValue('categoria_pai', lvalueInt)  then
begin
lvalueInt:= 0;
jBody.AddPair('categoria_pai', TJSONNull.Create);
  end else
begin
lvalue:= Format('/api/v1/categoria/%s', [lvalueInt.ToString]);
jBody.AddPair('categoria_pai', lvalue);
end;


Result:= jBody.ToJSON;
jBody.FreeInstance;
jReq.FreeInstance;

//    ID              XINTEGER NOT NULL /* XINTEGER = INTEGER DEFAULT 0 NOT NULL */,
//    DESCRICAO       X250 /* X250 = VARCHAR(250) */,
//    DETALHE         X600 /* X600 = VARCHAR(600) */,
//    ORDEM           XINTEGER /* XINTEGER = INTEGER DEFAULT 0 NOT NULL */,
//    ID_EXT          XINTEGER /* XINTEGER = INTEGER DEFAULT 0 NOT NULL */,
//    PARENT          XINTEGER /* XINTEGER = INTEGER DEFAULT 0 NOT NULL */,
//    SYNC            XINTEGER /* XINTEGER = INTEGER DEFAULT 0 NOT NULL */,
//    ULTATUALIZACAO  XTIMESTAMP /* XTIMESTAMP = TIMESTAMP */,
//    ID_PLATAFORMA   XINTEGER /* XINTEGER = INTEGER DEFAULT 0 NOT NULL */,
//    OCULTAR         XINTEGER /* XINTEGER = INTEGER DEFAULT 0 NOT NULL */,
//    NIVEL           XINTEGER /* XINTEGER = INTEGER DEFAULT 0 NOT NULL */

end;

function TTinyApi.ParseToParams(ParamsName, ParamsValue: string): string;
begin
LoadParams;
Result:= Format('?token=%s', [tiny_acess_token]);

if (paramsName <> '') and(ParamsValue <> '') then
Result:= Result + Format('&%s=%s', [paramsName, ParamsValue]);


Result:= Result + '&formato=json';
end;

function TTinyApi.ParseToProduto(pJson: string): string;
function IsDeleted(AValue: string): Boolean;
begin
Result:= (Copy(AValue, 1, 1) = '.') or(Pos('[EXCLUIDO]', Avalue) > 0);
end;
var
   jvariacoes: TJSONArray;
jvariacao: TJSONObject;
jenvelope: TJSONObject;
jgrade: TJSONObject;
//tags:TJSONArray;


jLoja: TJSONObject;
jo: TJSONObject;
jproduto: TJSONObject;
jproduto_web: TJSONObject;
jcategorias: TJSONArray;
jproduto_variacao: TJSONArray;
pictures: TJSONArray;
imagens_externas: TJSONArray;
imagem_externa: TJSONObject;
url: TJSONObject;

jv: TJSONValue;
obj: TJSONObject;

lpeso: Currency;
laltura: Currency;
llargura: Currency;
lprofundidade: Currency;

preco: Currency;
estoque: Currency;
sku: string;
idProduto: string;
descricao: string;
descricao_complementar: string;
Lixeira: array[0..9] of TObject;
iFor: Integer;
IsAtivo: Boolean;
Vender_Web: string;
xMarca: string;
xCor: string;
xTamanho: string;
xTamanhoOld: string;
xTamanhoNew: string;
Index: Integer;
xIdVariant: string;
idMain: string;
ncm: string;
cest: string;
categoria_preditiva: string;
idProdutoPai: string;
begin

{Essas variaveis estavam me gerando memori leaks }
jLoja:= TJSONObject.Create;
jo:= ParseToJSON(pJson);
jproduto:= jo.GetValue < TJSONObject > ('produto');
jproduto_web:= jo.GetValue < TJSONObject > ('produto_web');
try
    jproduto_variacao:= jo.GetValue < TJSONArray > ('produto_variacao');
except
jproduto_variacao:= TJSONArray.Create;
end;

//[pictures]
if not jo.TryGetValue('pictures', pictures) then
pictures:= TJSONArray.Create;


Lixeira[0] :=jproduto;
Lixeira[1] :=jproduto_web;
Lixeira[2] :=jproduto_variacao;
//Lixeira[3] :=; usado logo abaixo

idProduto:= jproduto.GetValue < Integer > ('id').ToString;
descricao:= jproduto.GetValue < string > ('descricao');
Vender_Web:= jproduto.GetValue < string > ('web');
xMarca:= jproduto.GetValue < string > ('nome_marca');
xCor:= jproduto.GetValue < string > ('nome_cor');
xTamanhoOld:= jproduto.GetValue < string > ('tamanho');
ncm:= jproduto.GetValue < string > ('ncm');
cest:= jproduto.GetValue < string > ('cest');
if not jo.TryGetValue('idProdutoPai', idProdutoPai) then
idProdutoPai:= '';

xTamanhoNew:= '';
TProdutoUtil.RemoveTamanhoDaDescricao(xTamanhoNew, xTamanhoOld, Descricao);
descricao:= lib.GetStrToFirstUpper(descricao);
IsAtivo:= True;

if IsDeleted(descricao) then
begin
descricao:= '[EXCLUIDO]' + idProduto;
IsAtivo:= False;
end;
if not jproduto_web.TryGetValue('detalhes_html', descricao_complementar) then
descricao_complementar:= '';
if Vender_Web = 'N' then
IsAtivo:= False;


jLoja.AddPair('codigo', TJSONString.Create('X' + idProduto));
jLoja.AddPair('nome', descricao);
jLoja.AddPair('unidade', jproduto.GetValue < string > ('unidade'));
jLoja.AddPair('origem', TJSONString.Create('0'));
jLoja.AddPair('situacao', TJSONString.Create('A'));
jLoja.AddPair('tipo', TJSONString.Create('P')); //produto("P")  serviço("S")
jLoja.AddPair('marca', TJSONString.Create(xMarca));
jLoja.AddPair('tipo_embalagem', TJSONString.Create('2'));
jLoja.AddPair('garantia', TJSONString.Create('3 meses'));
jLoja.AddPair('descricao_complementar', TJSONString.Create(descricao_complementar));
if idProdutoPai <> '' then
jLoja.AddPair('idProdutoPai', TJSONString.Create(idProdutoPai));


{$REGION 'Dados Fiscais ' }
if ncm <> '' then
begin
ncm:= Format('%s.%s.%s',
   [copy(ncm, 1, 4),
   copy(ncm, 5, 2),
   copy(ncm, 7, 2)
   ]);
jLoja.AddPair('ncm', TJSONString.Create(ncm));
end;


if cest <> '' then
begin
cest:= Format('%s.%s.%s',
   [copy(cest, 1, 2),
   copy(cest, 3, 3),
   copy(cest, 6, 2)
   ]);
jLoja.AddPair('cest', TJSONString.Create(cest));
end;


{ $ENDREGION }

estoque:= 0;
preco:= 0;
sku:= ''; Index:= 0; idMain:= '';
jvariacoes:= TJSONArray.Create;
//tags       := TJSONArray.Create;

for jv in jproduto_variacao do
   if jv is TJSONObject then
begin
obj:= jv as TJSONObject;
estoque:= 0;
preco:= 0;
sku:= '';
if not obj.TryGetValue('sku', sku) then
begin
sku:= '';
continue;
end;

Inc(Index);
if not obj.TryGetValue('tamanho', xtamanho) then
xtamanho:= '';

if not obj.TryGetValue('estoque', estoque) then
estoque:= 0;

if Vender_Web = 'N' then
estoque:= 0;

if not obj.TryGetValue('preco', preco) then
preco:= 0;
if not obj.TryGetValue('id_variant', xIdVariant) then
xIdVariant:= '';
if IdMain = '' then
begin
if not obj.TryGetValue('id_store', IdMain) then
IdMain:= '';
end;

xTamanho:= Ifthen(xTamanho = '', 'UNICO', xTamanho);

jenvelope:= TJSONObject.Create;
jVariacao:= TJSONObject.Create;
if xIdVariant <> '' then
jVariacao.AddPair('id', xIdVariant);

jVariacao.AddPair('codigo', sku);
jVariacao.AddPair('preco', TJSONNumber.Create(preco));
jVariacao.AddPair('estoque_atual', TJSONNumber.Create(estoque));

jgrade:= TJSONObject.Create;
jgrade.AddPair('Tamanho', xTamanho);
jgrade.AddPair('Cor', xCor);

jVariacao.AddPair('grade', jgrade);

jenvelope.AddPair('variacao', jvariacao);
jVariacoes.AddElement(jenvelope);
end;

{$REGION 'Tags - Tem que ser cadastrado antes' }
//tags.Add(xMarca);
//  if xCor <> '' then
//     tags.Add(xCor);

{ $ENDREGION }
if idMain <> '' then
begin
jLoja.AddPair('id', idMain);
  end else
if idMain = '' then
begin
if not jo.TryGetValue('categoria_preditiva', categoria_preditiva) then
categoria_preditiva:= ''
    else
jLoja.AddPair('categoria', categoria_preditiva);
end;

if Vender_Web = 'N' then
estoque:= 0;

if preco <= 0.01 then
preco:= 9999;


jLoja.AddPair('preco', TJSONNumber.Create(preco));
//jLoja.AddPair('preco_promocional',   TJSONNumber.Create(preco)  );
jLoja.AddPair('variacoes', jvariacoes);

{$REGION 'Dimensões do produto' }
lpeso:= 0;
laltura:= 0;
llargura:= 0;
lprofundidade:= 0;

if not jproduto_web.TryGetValue('peso', lpeso) then
lpeso:= 0;

if not jproduto_web.TryGetValue('largura', llargura) then
llargura:= 0;

if not jproduto_web.TryGetValue('altura', laltura) then
laltura:= 0;

if not jproduto_web.TryGetValue('comprimento', lprofundidade) then
lprofundidade:= 0; {O comprimento é a profundidade, Você pode estabelecer esse vinculo }

{ $ENDREGION }


jLoja.AddPair('peso_liquido', TJSONNumber.Create(lpeso));
jLoja.AddPair('peso_bruto', TJSONNumber.Create(lpeso));
jLoja.AddPair('altura_embalagem', TJSONNumber.Create(laltura));
jLoja.AddPair('comprimento_embalagem', TJSONNumber.Create(lprofundidade));
jLoja.AddPair('largura_embalagem', TJSONNumber.Create(llargura));
jLoja.AddPair('classe_produto', TJSONString.Create('V'));
{$REGION 'Tags - nao esta sendo usado' }
//  if tags.Count > 0 then
//     jLoja.AddPair('tags', tags );
{As tags podem ser adicionadas cfe. }
{ $ENDREGION }

imagens_externas:= TJSONArray.Create;
for jv in pictures do
   begin
   imagem_externa := TJSONObject.Create;
url:= TJSONObject.Create;
url.AddPair('url', TJSONString.Create(jv.GetValue < string > ('source')));
imagem_externa.AddPair('imagem_externa', url);
imagens_externas.AddElement(imagem_externa);
end;
jLoja.AddPair('imagens_externas', imagens_externas);


if sku = idProduto then
begin
//    if (StrToIntDef(id,0) > 0 ) then
//        jLoja.AddPair('id',TJSONNumber.Create( StrToIntDef(id,0)  )  );
//    jLoja.AddPair('preco',TJSONNumber.Create( preco  ) ) ;
//    jLoja.AddPair('estoque',TJSONNumber.Create( Trunc(Estoque)  ) ) ;
//    jLoja.AddPair('pictures', jproduto_image ) ;
  end else
begin
Lixeira[3] :=pictures;
end;

Result:= jLoja.ToJSON;
jLoja.Owned := True;
jLoja.DisposeOf;
for iFor := Low(Lixeira) to High(Lixeira) do
   begin
     try
      if Assigned(Lixeira[iFor]) then
Lixeira[iFor].DisposeOf;
except
end;
end;


//{
//      "produto": {
//        "sequencia": "4",
//        "codigo": "produto-api-1",
//        "nome": "produto api 1",
//        "unidade": "UN",
//        "preco": "50.25",
//        "preco_promocional": "42.25",
//        "origem": "0",
//        "situacao": "A",
//        "tipo": "P",
//        "marca": "teste",
//        "tipo_embalagem": "2",
//        "altura_embalagem": "26.50",
//        "comprimento_embalagem": "27.42",
//        "largura_embalagem": "28.00",
//        "classe_produto": "V",
//        "variacoes": [
//          {
//            "variacao": {
//              "codigo": "produto-api-1 - 1",
//              "preco": "35.32",
//              "estoque_atual": 12,
//              "grade": {
//                "Tamanho": "GG",
//                "Cor": "Branco"
//              }
//            }
//          },
//          {
//            "variacao": {
//              "codigo": "produto-api-1 - 2",
//              "preco": "32.34",
//              "estoque_atual": 15,
//              "grade": {
//                "Tamanho": "G",
//                "Cor": "Branco"
//              }
//            }
//          }
//        ]
//      }
//    }


end;

function TTinyApi.PedidoGet(pId: string): string;
begin
//  Result := ExecuteHTTP(Format('pedido/%s',[pId]),['GET'],['']);
end;

function TTinyApi.PedidoSearchGet(pJson: string): string;
//
//var
// LBody:TJSONObject;
//
// obj:TJSONObject;
// params:string;
// since_numero:integer;
// since_criado:string;
// limit:string;
// offset:string;
begin
//
//  {Formato data, hora é opcional
//    AAAA-MM-DDTHH:MM:SS
//  }
//
//
//  obj    := ParseToJSON(pJson);
//  LBody  := TJSONObject.Create;
//  if not obj.TryGetValue('since_numero',since_numero) then
//     since_numero:=0;
//
//  obj.TryGetValue('since_criado',since_criado);
//  obj.TryGetValue('offset',offset);
//  obj.TryGetValue('limit',limit);
//
//  params := Format('since_criado=%s&limit=%s&offset=%s',[since_criado,limit,offset]);
//  Result := ExecuteHTTP(Format('pedido/search/?%s',[params]),['GET'],['']);
//  LBody.Free;
//  obj.Free;

end;

function TTinyApi.ProdutoEstoquePut(pJson: string): string;


    procedure GetStockByCodigo(pCodigo, pJSON: string; out pestoque_atual: Currency; out pId:string);
var
   jo: TJSONObject;
ja: TJSONArray;
jv: TJSONValue;
o: TJSONObject;
codigo: string;
begin
if pJson = ''then
Exit;

jo:= ParseToJSON(PJSON);
try
        ja:= jo.GetValue < TJSONArray > ('variacoes');
except
ja:= TJSONArray.Create;
end;

{Buscar estoque do produto }
for jv in ja do
   if jv is TJSONObject then
begin
o:= jv as TJSONObject;
codigo:= '';
if not o.TryGetValue('variacao.codigo', codigo) then
codigo:= '-1';

if codigo = pCodigo then
begin
if not o.TryGetValue('variacao.id', pId) then
pId:= '0';

if not o.TryGetValue('variacao.estoque_atual', pestoque_atual) then
pestoque_atual:= 0;
Break;
end;

o:= nil;
end;

jo.Owned := True;
FreeAndNil(jo);
end;

var
   LBody: TJSONObject;
LEstoque: TJSONObject;
obj: TJSONObject;
codigo: string; {Codigo interno do sistema }
quantidade: Currency;
id: string;
begin
obj:= ParseToJSON(pJson);
LBody:= TJSONObject.Create;
LEstoque:= TJSONObject.Create;
if not obj.TryGetValue('codigo', codigo) then
codigo:= '0';

codigo:= OnlyNumber(Codigo);
GetStockByCodigo(codigo, pJson, quantidade, id);

if id <> '' then
begin
LEstoque.AddPair('idProduto', id); //Número de identificação do Produto no Tiny.
LEstoque.AddPair('tipo', 'B');      //'B' (balanço, onde o valor informado no campo quantidade vira o estoque atual).
LEstoque.AddPair('quantidade', TJSONNumber.Create(Trunc(quantidade)));
LBody.AddPair('estoque', LEstoque);
Result:= ExecuteHTTP('/produto.atualizar.estoque.php' + ParseToParams('estoque', LBody.ToJSON), 'POST', '');
  end else
begin
Result:= LBody.ToJSON;
end;


//{
//  "estoque": {
//    "idProduto": "12345888",
//    "tipo": "E",
//    "data": "2017-03-27 13:03:00",
//    "quantidade": "7",
//    "precoUnitario": "25.78",
//    "observacoes": "observação do lançamento",
//    "deposito": "deposito central"
//  }
//}



Obj.Owned := True;
FreeAndNil(Obj);
LBody.Owned := True;
FreeAndNil(LBody)
end;

function TTinyApi.ProdutoEstoqueSearch(pIdProduto: string): string;
begin
Result:= ExecuteHTTP('/produto.obter.estoque.php' + ParseToParams('id', pIdProduto), 'POST', '');
end;

function TTinyApi.ProdutoGet(pIdProduto: string): string;
begin
Result:= ExecuteHTTP('/produto.obter.php' + ParseToParams('id', pIdProduto), 'GET', '');
end;

function TTinyApi.ProdutoImagemPost(pJson: string): string;
var
   jpictures: TJSONArray;
jv: TJSONValue;
LBody: TJSONObject;
obj: TJSONObject;
lid: Integer;
lproduto: string;
limagem_url: string;
lprincipal: Boolean;
lposicao: Integer;
lOwner: Boolean;
begin
//  lOwner:= False;
//  if pJson='' then Exit;
//  obj := ParseToJSON(pJson);
//  if not obj.TryGetValue('id',lid) then
//     lid:=0;
//  if not obj.TryGetValue('pictures',jpictures) then
//  begin
//     jpictures := TJSONArray.Create;
//     lOwner := True;
//  end;
//
//  lposicao   := 0;
//  for jv in jpictures do
//  if jv is TJSONObject then
//  begin
//    limagem_url :='';
//    if not (jv as TJSONObject).TryGetValue('source',limagem_url) then
//      continue;
//
//    lprincipal := lposicao=0;  //validar pela idvariacao;
//    LBody := TJSONObject.Create;
//    lproduto :=Format('/api/v1/produto/%s', [lid.toString]);
//    LBody.AddPair('imagem_url', limagem_url);
//    LBody.AddPair('produto', TJSONString.Create(lproduto) );
//    LBody.AddPair('principal', TJSONBool.Create(lprincipal) );
//    LBody.AddPair('posicao', TJSONNumber.Create(lposicao)  );
//    LBody.AddPair('mime', TJSONString.Create('image/jpeg'));
//
//    Result := ExecuteHTTP('produto_imagem',['POST'],[LBody.ToJSON]);
//    Inc(lposicao);
//    LBody.DisposeOf;
//  end;
//  obj.FreeInstance;
//  if lOwner  then
//     jpictures.FreeInstance;

end;

function TTinyApi.ProdutoImagemPut(pJson: string): string;
var
   jpictures: TJSONArray;
jv: TJSONValue;
LBody: TJSONObject;
jObjects: TJSONArray;
jResults: TJSONObject;
obj: TJSONObject;
lid: Integer;
lproduto: string;
limagem_url: string;
lprincipal: Boolean;
lposicao: Integer;
lreturn: string;
lImagesCount: Integer;
lOwner: Boolean;
begin
//  lOwner:= False;
//  if pJson='' then Exit;
//  obj := ParseToJSON(pJson);
//  if not obj.TryGetValue('id',lid) then
//     lid:=0;
//  if not obj.TryGetValue('pictures',jpictures) then
//  begin
//     jpictures := TJSONArray.Create;
//     lOwner:= True;
//  end;
//  lImagesCount :=0;
//  lreturn  := ExecuteHTTP(Format('produto_imagem/?produto=%s',[lid.toString]),['GET'],['']);
//  jResults := ParseToJSON(lreturn);
//  jObjects := jResults.GetValue<TJSONArray>('objects');
//  for jv in jObjects do
//    Inc(lImagesCount);
//
//  jResults.FreeInstance;
//  jObjects.FreeInstance;
//
//
//  lposicao   := 0;
//  for jv in jpictures do
//  if jv is TJSONObject then
//  begin
//    Inc(lposicao);
//
//    limagem_url :='';
//    if (not (jv as TJSONObject).TryGetValue('source',limagem_url)) or
//       (lposicao <= lImagesCount) then
//         Continue;
//
//    lprincipal := Pred(lposicao)=0;  //validar pela idvariacao;
//    LBody := TJSONObject.Create;
//    lproduto :=Format('/api/v1/produto/%s', [lid.toString]);
//    LBody.AddPair('imagem_url', limagem_url);
//    LBody.AddPair('produto', TJSONString.Create(lproduto) );
//    LBody.AddPair('principal', TJSONBool.Create(lprincipal) );
//    LBody.AddPair('posicao', TJSONNumber.Create( Pred(lposicao))  ); //começa em zero
//    LBody.AddPair('mime', TJSONString.Create('image/jpeg'));
//
//    Result := ExecuteHTTP('produto_imagem',['POST'],[LBody.ToJSON]);
//    LBody.DisposeOf;
//  end;
//  obj.FreeInstance;
//  if lOwner then
//     jpictures.DisposeOf;
end;

function TTinyApi.ProdutoPost(pJson: string): string;
var
   LBody: TJSONObject;

jproduto: TJSONObject;
jo: TJSONObject;
ja: TJSONArray;
params: string;
begin
jo:= ParseToJSON(pJson);
jo.AddPair('sequencia', '1');
ja:= TJSONArray.Create;
LBody:= TJSONObject.Create;
jproduto:= TJSONObject.Create;
jproduto.AddPair('produto', jo);


ja.AddElement(jproduto);
params:= ParseToParams('produto', 'produto');

LBody.AddPair('produtos', ja);
Result:= ExecuteHTTP('/produto.incluir.php' + params, 'POST', LBody.ToJSON);
LBody.DisposeOf;
end;

function TTinyApi.ProdutoPrecoPut(pJson: string): string;
var
   LBody: TJSONObject;
jo: TJSONObject;
begin
{
   captura o campo produto_atualizar_preco: []
}
jo:= ParseToJSON(pJson);
LBody:= jo.GetValue < TJSONObject > ('produto_atualizar_preco');

//Modelo para enviar para Tiny
//{
//  "precos": [
//    {
//      "id": "123",
//      "preco": "20.5",
//      "preco_promocional": "0"
//    },
//    {
//      "id": "456",
//      "preco": "30.0",
//      "preco_promocional": "25.5"
//    }
//  ]
//}
try
    Result:= ExecuteHTTP('/produto.atualizar.precos.php' + ParseToParams('', ''), 'POST', LBody.ToJSON);
  finally
    jo.DisposeOf;
end;
end;

function TTinyApi.ProdutoPut(pJson: string): string;
var
   LIndex: Integer;
LBody: TJSONObject;
jsonProduto: string;
Lid: string;
sku: string;

produto_tipo_embalagem: Integer;
produto_altura_embalagem: Currency;
produto_largura_embalagem: Currency;
produto_comprimento_embalagem: Currency;
produto_diametro_embalagem: Currency;
produto_peso_liquido: Currency;
produto_peso_bruto: Currency;
produto_garantia: string;
garantia: string;
produto_sku: string;
produto_marca: string;
marca: string;
imagens_externas: TJSONArray;
produto_imagens_externas: TJSONArray;



jEnvelope: TJSONObject;
jProduto: TJSONObject;
jRetorno: TJSONObject;
jProdutos: TJSONObject;
jList: TJSONArray;
jProdutoUpdate: TJSONObject;
lPrice: Currency;
lPriceOld: string;

o: TJSONObject;
jVariacoes: TJSONArray;
jVariacao: TJSONValue;
item: TJSONObject;
idProdutoPai: string;
begin
LIndex:= 0;
lid:= '';
LBody:= ParseToJSON(pJson); LBody.Owned := True;

{$REGION 'captura dados' }
if not LBody.TryGetValue('id', lid) then
lid:= '';
if not LBody.TryGetValue('idProdutoPai', idProdutoPai) then
idProdutoPai:= '';



if not LBody.TryGetValue('codigo', sku) then
sku:= FormatDateTime('yyyymmddhhnnsszzz', Now);

if not LBody.TryGetValue('preco', lPrice) then
lPrice:= 0;
{ $ENDREGION }


if lid = '' then
begin
Result:= '';
Exit;
end;

try
    jsonProduto:= ProdutoGet(lId);
if jsonProduto = '' then
Exit;

jEnvelope:= ParseToJSON(jsonProduto);
jRetorno:= jEnvelope.GetValue < TJSONObject > ('retorno');
jProduto:= jRetorno.GetValue < TJSONObject > ('produto');
except
begin
Result:= jsonProduto;
end;
end;
if not Assigned(jProduto) then
Exit;

Inc(LIndex);
jProduto.RemovePair('preco');
jProduto.AddPair('sequencia', LIndex.ToString);
jProduto.AddPair('preco', TJSONString.Create(toCurrStr(lPrice)));
{$REGION 'Captura dados devido Case sensitive ser diferente da consulta ' }
//--------------------------------------------------
if not jProduto.TryGetValue('tipoEmbalagem', produto_tipo_embalagem) then
produto_tipo_embalagem:= 0;

if not jProduto.TryGetValue('diametroEmbalagem', produto_diametro_embalagem) then
produto_diametro_embalagem:= 0;

//--------------------------------------------------
if not LBody.TryGetValue('altura_embalagem', produto_altura_embalagem) then
produto_altura_embalagem:= 0;

if not LBody.TryGetValue('comprimento_embalagem', produto_comprimento_embalagem) then
produto_comprimento_embalagem:= 0;

if not LBody.TryGetValue('largura_embalagem', produto_largura_embalagem) then
produto_largura_embalagem:= 0;

if not LBody.TryGetValue('peso_liquido', produto_peso_liquido) then
produto_peso_liquido:= 0;

if not LBody.TryGetValue('peso_bruto', produto_peso_bruto) then
produto_peso_bruto:= 0;

if not LBody.TryGetValue('garantia', garantia) then
garantia:= '3 meses';

if not LBody.TryGetValue('marca', marca) then
marca:= '';

if not LBody.TryGetValue('imagens_externas', imagens_externas) then
imagens_externas:= TJSONArray.Create;

if not jProduto.TryGetValue('imagens_externas', produto_imagens_externas) then
produto_imagens_externas:= TJSONArray.Create;

if imagens_externas.toJSON <> produto_imagens_externas.toJSON  then
begin
jProduto.RemovePair('imagens_externas');
jProduto.AddPair('imagens_externas', imagens_externas);
end;


try
    if not jProduto.TryGetValue('variacoes', jvariacoes) then
jvariacoes:= nil;
except
jvariacoes:= nil;
end;

if Assigned(jvariacoes) then
begin
for jvariacao in jvariacoes do
   begin
      o := jvariacao as TJSONObject;
lPriceOld:= '0';
if not o.TryGetValue('variacao.preco', lPriceOld) then
lPriceOld:= '0';

if toCurrStr(lPrice) <> lPriceOld then
begin
item:= o.GetValue < TJSONObject > ('variacao');
item.RemovePair('preco');
item.AddPair('preco', TJSONString.Create(toCurrStr(lPrice)));
end;
end;
end;

if not jProduto.TryGetValue('codigo', produto_sku) then
produto_sku:= '';

if Copy(produto_sku, 1, 1) = '@' then
begin
produto_sku:= StringReplace(produto_sku, '@', 'X', [rfReplaceAll]);
  end else
begin
produto_sku:= '';
end;

if not jProduto.TryGetValue('garantia', produto_garantia) then
produto_garantia:= '';

if not jProduto.TryGetValue('marca', produto_marca) then
produto_marca:= '';

if produto_sku <> '' then
jProduto.RemovePair('codigo');

if produto_garantia <> garantia then
jProduto.RemovePair('garantia');
if produto_marca <> marca then
jProduto.RemovePair('marca');



jProduto.RemovePair('tipoEmbalagem');
jProduto.RemovePair('alturaEmbalagem');
jProduto.RemovePair('comprimentoEmbalagem');
jProduto.RemovePair('larguraEmbalagem');
jProduto.RemovePair('diametroEmbalagem');
jProduto.RemovePair('peso_liquido');
jProduto.RemovePair('peso_bruto');

//  if idProdutoPai <> '' then
//  begin
//    jProduto.RemovePair('idProdutoPai');
//    jProduto.AddPair('idProdutoPai', TJSONString.Create(idProdutoPai) );
//
//    jProduto.RemovePair('tipoVariacao');
//    jProduto.AddPair('tipoVariacao', TJSONString.Create('V') );
//
//    jProduto.RemovePair('situacao');
//    jProduto.AddPair('situacao', TJSONString.Create('A') );
//
//  end;


jProduto.AddPair('tipo_embalagem', TJSONNumber.Create(produto_tipo_embalagem));
jProduto.AddPair('altura_embalagem', TJSONNumber.Create(produto_altura_embalagem));
jProduto.AddPair('comprimento_embalagem', TJSONNumber.Create(produto_comprimento_embalagem));
jProduto.AddPair('largura_embalagem', TJSONNumber.Create(produto_largura_embalagem));
jProduto.AddPair('diametro_embalagem', TJSONNumber.Create(produto_diametro_embalagem));
jProduto.AddPair('peso_liquido', TJSONNumber.Create(produto_peso_liquido));
jProduto.AddPair('peso_bruto', TJSONNumber.Create(produto_peso_bruto));

if produto_garantia <> garantia then
jProduto.AddPair('garantia', TJSONString.Create(garantia));
if produto_marca <> marca then
jProduto.AddPair('marca', TJSONString.Create(marca));
if produto_sku <> '' then
jProduto.AddPair('codigo', TJSONString.Create(produto_sku));
//----------------------------------------------------------------------------
jList:= TJSONArray.Create;
jProdutoUpdate:= TJSONObject.Create;
jProdutoUpdate.AddPair('produto', jProduto);
jList.AddElement(jProdutoUpdate);

{$REGION 'produto.alterar.php' }
jProdutos:= TJSONObject.Create; {Foi modificado conforme orientação da Tiny }
jProdutos.AddPair('produtos', jList);

try
    Result:= ExecuteHTTP('/produto.alterar.php' + ParseToParams('produto', 'produto'), 'POST', jProdutos.toJSON);
except
end;
try
    jEnvelope.Owned := True;
jProdutos.Owned := True;
jList.Owned      := True;
jEnvelope.DisposeOf;
except
end;

{ $ENDREGION }
LBody.DisposeOf
end;

function TTinyApi.ProdutoPutImagens(pJson: string): string;

    procedure GetIdByCodigo(ACodigo, AJSON: string; out pId:string);
var
   jo: TJSONObject;
ja: TJSONArray;
jv: TJSONValue;
o: TJSONObject;
codigo: string;
begin
if pJson = ''then
Exit;

jo:= ParseToJSON(AJSON);
try
        ja:= jo.GetValue < TJSONArray > ('variacoes');
except
ja:= TJSONArray.Create;
end;

{Buscar estoque do produto }
for jv in ja do
   if jv is TJSONObject then
begin
o:= jv as TJSONObject;
codigo:= '';
if not o.TryGetValue('variacao.codigo', codigo) then
codigo:= '-1';

if codigo = ACodigo then
begin
if not o.TryGetValue('variacao.id', pId) then
pId:= '0';

Break;
end;

o:= nil;
end;

jo.Owned := True;
FreeAndNil(jo);
end;


var
   LIndex: Integer;
LBody: TJSONObject;
jsonProduto: string;
Lid: string;
sku: string;

produto_tipo_embalagem: Integer;
produto_altura_embalagem: Currency;
produto_largura_embalagem: Currency;
produto_comprimento_embalagem: Currency;
produto_diametro_embalagem: Currency;
produto_peso_liquido: Currency;
produto_peso_bruto: Currency;
produto_garantia: string;
garantia: string;
produto_marca: string;
marca: string;
imagens_externas: TJSONArray;
produto_imagens_externas: TJSONArray;



jEnvelope: TJSONObject;
jProduto: TJSONObject;
jRetorno: TJSONObject;
jProdutos: TJSONObject;
jList: TJSONArray;
jProdutoUpdate: TJSONObject;
lPrice: Currency;
lPriceOld: string;

o: TJSONObject;
jVariacoes: TJSONArray;
jVariacao: TJSONValue;
item: TJSONObject;

id_do_codigo: string;
idProdutoPai: string;
begin

LIndex:= 0;
lid:= '';
LBody:= ParseToJSON(pJson); LBody.Owned := True;

{$REGION 'captura dados' }
if not LBody.TryGetValue('id', lid) then
lid:= '';

if not LBody.TryGetValue('codigo', sku) then
sku:= FormatDateTime('yyyymmddhhnnsszzz', Now);

if not LBody.TryGetValue('preco', lPrice) then
lPrice:= 0;
{ $ENDREGION }

GetIdByCodigo(OnlyNumber(sku), pJSON, id_do_codigo);

if id_do_codigo <> '' then
lid:= id_do_codigo;



if lid = '' then
begin
Result:= '';
Exit;
end;

try
    jsonProduto:= ProdutoGet(lId);
if jsonProduto = '' then
Exit;

jEnvelope:= ParseToJSON(jsonProduto);
jRetorno:= jEnvelope.GetValue < TJSONObject > ('retorno');
jProduto:= jRetorno.GetValue < TJSONObject > ('produto');
except
begin
Result:= jsonProduto;
end;
end;
if not Assigned(jProduto) then
Exit;

Inc(LIndex);
jProduto.RemovePair('preco');
jProduto.AddPair('sequencia', LIndex.ToString);
jProduto.AddPair('preco', TJSONString.Create(toCurrStr(lPrice)));
{$REGION 'Captura dados devido Case sensitive ser diferente da consulta ' }
//--------------------------------------------------
if not jProduto.TryGetValue('tipoEmbalagem', produto_tipo_embalagem) then
produto_tipo_embalagem:= 0;

if not jProduto.TryGetValue('diametroEmbalagem', produto_diametro_embalagem) then
produto_diametro_embalagem:= 0;

//--------------------------------------------------
if not LBody.TryGetValue('altura_embalagem', produto_altura_embalagem) then
produto_altura_embalagem:= 0;

if not LBody.TryGetValue('comprimento_embalagem', produto_comprimento_embalagem) then
produto_comprimento_embalagem:= 0;

if not LBody.TryGetValue('largura_embalagem', produto_largura_embalagem) then
produto_largura_embalagem:= 0;

if not LBody.TryGetValue('peso_liquido', produto_peso_liquido) then
produto_peso_liquido:= 0;

if not LBody.TryGetValue('peso_bruto', produto_peso_bruto) then
produto_peso_bruto:= 0;

if not LBody.TryGetValue('garantia', garantia) then
garantia:= '3 meses';

if not LBody.TryGetValue('marca', marca) then
marca:= '';

if not LBody.TryGetValue('imagens_externas', imagens_externas) then
imagens_externas:= TJSONArray.Create;

if not jProduto.TryGetValue('imagens_externas', produto_imagens_externas) then
produto_imagens_externas:= TJSONArray.Create;

//deixar tudo zerada
jProduto.RemovePair('imagens_externas');
jProduto.AddPair('imagens_externas', TJSONArray.Create);

jvariacoes:= nil;

if not jProduto.TryGetValue('idProdutoPai', idProdutoPai) then
idProdutoPai:= '';

if idProdutoPai = '' then
begin
if not jProduto.TryGetValue('variacoes', jvariacoes) then
jvariacoes:= nil;
end;

if Assigned(jvariacoes) then
begin
for jvariacao in jvariacoes do
   begin
      o := jvariacao as TJSONObject;
lPriceOld:= '0';
if not o.TryGetValue('variacao.preco', lPriceOld) then
lPriceOld:= '0';

if toCurrStr(lPrice) <> lPriceOld then
begin
item:= o.GetValue < TJSONObject > ('variacao');
item.RemovePair('preco');
item.AddPair('preco', TJSONString.Create(toCurrStr(lPrice)));
end;
end;
end;


if not jProduto.TryGetValue('garantia', produto_garantia) then
produto_garantia:= '';

if not jProduto.TryGetValue('marca', produto_marca) then
produto_marca:= '';


if produto_garantia <> garantia then
jProduto.RemovePair('garantia');
if produto_marca <> marca then
jProduto.RemovePair('marca');


jProduto.RemovePair('tipoEmbalagem');
jProduto.RemovePair('alturaEmbalagem');
jProduto.RemovePair('comprimentoEmbalagem');
jProduto.RemovePair('larguraEmbalagem');
jProduto.RemovePair('diametroEmbalagem');
jProduto.RemovePair('peso_liquido');
jProduto.RemovePair('peso_bruto');


jProduto.AddPair('tipo_embalagem', TJSONNumber.Create(produto_tipo_embalagem));
jProduto.AddPair('altura_embalagem', TJSONNumber.Create(produto_altura_embalagem));
jProduto.AddPair('comprimento_embalagem', TJSONNumber.Create(produto_comprimento_embalagem));
jProduto.AddPair('largura_embalagem', TJSONNumber.Create(produto_largura_embalagem));
jProduto.AddPair('diametro_embalagem', TJSONNumber.Create(produto_diametro_embalagem));
jProduto.AddPair('peso_liquido', TJSONNumber.Create(produto_peso_liquido));
jProduto.AddPair('peso_bruto', TJSONNumber.Create(produto_peso_bruto));
if produto_garantia <> garantia then
jProduto.AddPair('garantia', TJSONString.Create(garantia));
if produto_marca <> marca then
jProduto.AddPair('marca', TJSONString.Create(marca));


//----------------------------------------------------------------------------
jList:= TJSONArray.Create;
jProdutoUpdate:= TJSONObject.Create;
jProdutoUpdate.AddPair('produto', jProduto);
jList.AddElement(jProdutoUpdate);


{$REGION 'produto.alterar.php' }
{Foi modificado conforme orientação da Tiny }
jProdutos:= TJSONObject.Create;
jProdutos.AddPair('produtos', jList);

try
    Result:= ExecuteHTTP('/produto.alterar.php' + ParseToParams('produto', 'produto'), 'POST', jProdutos.toJSON);
except
end;



try
    jEnvelope.Owned := True;
jProdutos.Owned := True;
jList.Owned      := True;
jEnvelope.DisposeOf;
except
end;
{ $ENDREGION }

LBody.DisposeOf
end;


procedure TTinyApi.SetIdStore(const value: string);
begin
FId_store:= value;
end;

procedure TTinyApi.SetJSONBody(pValue: string);
begin
FReq_JSON:= pValue;
GetWstore;   //ja instancia a loja que esta logada
end;

end.