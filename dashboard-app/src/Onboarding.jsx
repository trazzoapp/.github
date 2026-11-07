import React from "react";

export default function Onboarding({ onPickFolder }) {
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h1>Trazzo Control</h1>
        <p className="onboarding-lede">
          Panel local para manejar todos los repos de un monorepo desde una sola ventana.
        </p>

        <ol className="onboarding-steps">
          <li>
            <strong>Elegí la carpeta raíz</strong> que contiene tus repos (la que tiene
            <code> trazzo-api</code>, <code>trazzo-app</code>, etc. como subcarpetas).
          </li>
          <li>
            La app detecta sola cada repo con <code>package.json</code> y te muestra su
            estado de git, su puerto y si está corriendo.
          </li>
          <li>
            Desde cada card podés <strong>arrancar / parar</strong> el servicio y ver sus{" "}
            <strong>logs en vivo</strong>. También podés matar cualquier puerto ocupado
            desde la pestaña de Puertos.
          </li>
        </ol>

        <button className="btn btn-primary btn-lg" onClick={onPickFolder}>
          Elegir carpeta de proyectos…
        </button>
      </div>
    </div>
  );
}
