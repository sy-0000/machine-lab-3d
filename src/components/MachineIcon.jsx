/** Line drawing of a machine (home cards and the loading screen). */
export default function MachineIcon({ id }) {
  return (
    <svg viewBox="0 0 320 190" fill="none" aria-hidden="true">
      <path pathLength="1" d="M20 170H300M40 180H280" stroke="#34524c" />
      <g stroke="#91dec2" strokeWidth="3" strokeLinejoin="round">
        {id === 'lathe' ? (
          <>
            <path pathLength="1" d="M45 150V65H103V130H270V150ZM245 130V95H270V150M103 106H245M152 106V88H186V129M59 65V38H100V65" />
            <circle pathLength="1" cx="92" cy="87" r="14" />
            <circle pathLength="1" cx="162" cy="122" r="10" />
            <path pathLength="1" d="M104 86H134M200 105V84H236V105M55 150V168M255 150V168" />
          </>
        ) : id === 'milling' ? (
          <>
            <path pathLength="1" d="M65 165V38H134V165ZM49 165H173V176H49ZM108 39V23H212V48H108ZM185 48V74H204V48M194 74V98M108 115H274V132H108ZM130 132V154H242V132" />
            <circle pathLength="1" cx="259" cy="142" r="11" />
            <path pathLength="1" d="M68 63H100M166 115V102H228V115" />
          </>
        ) : (
          <>
            <path pathLength="1" d="M74 169H240V181H74ZM104 169V32H119V169M80 32V17H227V51H80ZM192 51V71H216V51M203 71V105M119 121H243V132H119" />
            <circle pathLength="1" cx="230" cy="56" r="8" />
            <path pathLength="1" d="M235 52L263 29M237 60L269 73M228 64L222 98" />
          </>
        )}
      </g>
    </svg>
  );
}
