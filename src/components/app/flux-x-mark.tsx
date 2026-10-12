type FluxXMarkProps = {
  className?: string;
  monochrome?: boolean;
  onDark?: boolean;
};

export function FluxXMark({ className, monochrome = false, onDark = false }: FluxXMarkProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      viewBox="0 0 300 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M58 28H145C163 28 177 36 188 51L201 68L164 91L152 75C149 71 145 69 139 69H99C92 69 88 74 88 81V114H132C140 114 146 117 151 123L166 141H88V211C88 218 83 223 76 223H55C48 223 43 218 43 211V43C43 35 50 28 58 28Z"
        fill={monochrome || onDark ? "#FFFFFF" : "#123B62"}
      />
      <path
        d="M83 126L198 64C202 62 207 60 213 59L239 56C243 55 245 59 243 63L215 119L198 137H83V126Z"
        fill={monochrome ? "#FFFFFF" : "#159DC6"}
      />
      <path
        d="M98 129L190 80L211 121L198 136H98V129Z"
        fill={monochrome ? "#FFFFFF" : "#55C9D9"}
      />
      <path
        d="M83 140H198L215 158L243 203C245 207 242 211 238 210L213 207C207 206 202 204 198 202L83 151V140Z"
        fill={monochrome ? "#FFFFFF" : "#078FA5"}
      />
      <path
        d="M99 141H197L210 153L190 160L99 148V141Z"
        fill={monochrome ? "#FFFFFF" : "#35C9A7"}
      />
      <circle cx="83" cy="138" r="21" fill={monochrome ? "#FFFFFF" : "#35C9A7"} stroke={monochrome || onDark ? "#123B62" : "#F6FAFC"} strokeWidth="7" />
    </svg>
  );
}
